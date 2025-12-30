import storage from "@util/storage";
import pako from "pako";
import { makePath, isBinaryFile } from "@util/path";
import { Base64 } from "js-base64";

const BUNDLE_CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB limit to stay under 4MB API limit
const BUNDLE_PREFIX = "bundle.gz.part.";

// Memory cache for bundles to avoid redundant parsing
const REMOTE_BUNDLE_CACHE = new Map();

// Cache file paths
const CACHE_DIR = 'local/cache';
const getCachePath = (endPoint, type) => `${CACHE_DIR}/${endPoint}_${type}.json`;
const MASTER_MANIFEST_PATH = `${CACHE_DIR}/_bundle_manifest.json`;

// Lock to prevent concurrent updates to master manifest
let manifestUpdateLock = Promise.resolve();
let pendingManifestUpdates = {};
let manifestUpdateTimer = null;

async function getMasterManifest() {
    try {
        if (await storage.exists(MASTER_MANIFEST_PATH)) {
            const manifestStr = await storage.readFile(MASTER_MANIFEST_PATH);
            return JSON.parse(manifestStr);
        }
    } catch (err) {
        console.error("[Bundle] Error reading master manifest:", err);
    }
    return {};
}

async function updateMasterManifest(endPoint, versionInfo) {
    // Batch updates to avoid race conditions
    pendingManifestUpdates[endPoint] = versionInfo;

    // Debounce writes - wait 50ms for more updates to batch together
    if (manifestUpdateTimer) {
        clearTimeout(manifestUpdateTimer);
    }

    manifestUpdateTimer = setTimeout(flushManifestUpdates, 50);
}

async function flushManifestUpdates() {
    if (manifestUpdateTimer) {
        clearTimeout(manifestUpdateTimer);
        manifestUpdateTimer = null;
    }

    if (Object.keys(pendingManifestUpdates).length === 0) {
        return manifestUpdateLock;
    }

    // Execute write with lock to prevent concurrent modifications
    manifestUpdateLock = manifestUpdateLock.then(async () => {
        try {
            const updates = { ...pendingManifestUpdates };
            pendingManifestUpdates = {};

            if (Object.keys(updates).length > 0) {
                const manifest = await getMasterManifest();
                Object.assign(manifest, updates);
                // Ensure cache directory exists before writing
                await storage.createFolderPath(MASTER_MANIFEST_PATH);
                await storage.writeFile(MASTER_MANIFEST_PATH, JSON.stringify(manifest));
            }
        } catch (err) {
            console.error("[Bundle] Error updating master manifest:", err);
        }
    });

    return manifestUpdateLock;
}

// Export flush function so sync can ensure manifest is saved before finishing
export { flushManifestUpdates };

function createInventoryFromParts(bundleParts) {
    return bundleParts.map(p => ({
        name: p.name,
        mtime: p.mtimeMs || 0
    }));
}

function sortBundleParts(bundleParts) {
    return bundleParts.sort((a, b) => {
        const indexA = parseInt(a.name.split(BUNDLE_PREFIX)[1]);
        const indexB = parseInt(b.name.split(BUNDLE_PREFIX)[1]);
        return indexA - indexB;
    });
}

export async function checkBundleVersion(endPoint, listing = null) {
    try {
        // Wait for any pending manifest updates to complete before reading
        // This ensures timestamps from previous sync are available
        await manifestUpdateLock;

        const manifest = await getMasterManifest();
        const cachedVersion = manifest[endPoint];

        // OPTIMIZATION: If we have a recent version check (within last 10 minutes), trust it
        // This avoids expensive remote listing calls for recently synced bundles
        const CACHE_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes
        if (cachedVersion?.timestamp && (Date.now() - cachedVersion.timestamp) < CACHE_VALIDITY_MS) {
            // Trust the cached version without checking remote
            return { changed: false, versionInfo: cachedVersion, listing: null };
        }

        // Need to check remote - fetch listing if not provided
        if (!listing) {
            listing = await storage.getListing(endPoint) || [];
        }

        const bundleParts = listing.filter(item => item.name?.startsWith(BUNDLE_PREFIX));

        if (!bundleParts.length) {
            return { changed: true, versionInfo: null, listing };
        }

        sortBundleParts(bundleParts);
        const inventory = createInventoryFromParts(bundleParts);
        const currentInventoryHash = JSON.stringify(inventory);

        const now = Date.now();

        if (cachedVersion?.inventoryHash === currentInventoryHash) {
            // Hash matches - no changes
            const updatedVersion = { inventoryHash: currentInventoryHash, timestamp: now };
            await updateMasterManifest(endPoint, updatedVersion);
            return { changed: false, versionInfo: updatedVersion, listing };
        }

        // Hash changed - update manifest with new hash and timestamp for next time
        const newVersion = { inventoryHash: currentInventoryHash, timestamp: now };
        await updateMasterManifest(endPoint, newVersion);
        return {
            changed: true,
            versionInfo: newVersion,
            listing
        };
    } catch (err) {
        console.error("[Bundle] Error checking version:", err);
        return { changed: true, versionInfo: null, listing: null };
    }
}


function normalizeContent(content) {
    if (typeof content !== "string") {
        return content;
    }
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.stringify(JSON.parse(trimmed));
        } catch {
            return trimmed;
        }
    }
    return trimmed;
}

export async function getRemoteBundle(endPoint, listing = null) {
    const cachedInMemory = REMOTE_BUNDLE_CACHE.get(endPoint);
    if (cachedInMemory && !listing) {
        return cachedInMemory;
    }

    if (!listing) {
        listing = await storage.getListing(endPoint) || [];
    }
    const bundleParts = listing.filter(item => item.name?.startsWith(BUNDLE_PREFIX));

    if (!bundleParts.length) {
        console.warn(`[Bundle] No bundle parts found for ${endPoint}`);
        return null;
    }

    sortBundleParts(bundleParts);
    const inventory = createInventoryFromParts(bundleParts);

    const versionPath = getCachePath(endPoint, 'version');
    const cachePath = getCachePath(endPoint, 'bundle');
    const inventoryPath = getCachePath(endPoint, 'inventory');

    const currentInventoryHash = JSON.stringify(inventory);

    try {
        if (await storage.exists(versionPath)) {
            const versionInfo = JSON.parse(await storage.readFile(versionPath));

            if (versionInfo.inventoryHash === currentInventoryHash) {
                if (cachedInMemory?._inventoryHash === currentInventoryHash) {
                    return cachedInMemory;
                }

                if (await storage.exists(cachePath)) {
                    const cachedBundleStr = await storage.readFile(cachePath);
                    if (cachedBundleStr) {
                        try {
                            const bundle = JSON.parse(cachedBundleStr);
                            Object.defineProperty(bundle, "_inventoryHash", {
                                value: currentInventoryHash,
                                enumerable: false,
                                writable: true
                            });
                            REMOTE_BUNDLE_CACHE.set(endPoint, bundle);
                            return bundle;
                        } catch (e) {
                            console.error("[Bundle] Failed to parse cached bundle:", e);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("[Bundle] Cache check failed, downloading:", err);
    }

    const parts = [];
    for (const part of bundleParts) {
        try {
            const content = await storage.readFile(part.path);
            if (content) {
                parts.push(content.trim());
            } else {
                console.error(`[Bundle] Empty content for part ${part.path}`);
            }
        } catch (err) {
            console.error(`[Bundle] Error reading part ${part.path}:`, err);
        }
    }

    if (!parts.length) {
        return null;
    }

    try {
        const joinedBase64 = parts.join("");
        if (!joinedBase64) {
            console.error("[Bundle] Empty Base64 string");
            return null;
        }

        const binaryString = Base64.atob(joinedBase64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));

        if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
            console.error("[Bundle] Invalid gzip header");
            return null;
        }

        const jsonString = pako.ungzip(bytes, { to: "string" });
        const bundle = JSON.parse(jsonString);

        Object.defineProperty(bundle, "_inventoryHash", {
            value: currentInventoryHash,
            enumerable: false,
            writable: true
        });

        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(inventory));

        const versionInfo = { inventoryHash: currentInventoryHash, timestamp: Date.now() };
        await storage.writeFile(versionPath, JSON.stringify(versionInfo));
        await updateMasterManifest(endPoint, versionInfo);

        REMOTE_BUNDLE_CACHE.set(endPoint, bundle);
        return bundle;
    } catch (err) {
        console.error("[Bundle] Error parsing bundle:", err);
        return null;
    }
}


export async function saveRemoteBundle(endPoint, bundle) {
    try {
        const jsonString = JSON.stringify(bundle);
        const bytes = pako.gzip(jsonString);
        const base64String = Base64.fromUint8Array(bytes);

        const chunks = [];
        for (let i = 0; i < base64String.length; i += BUNDLE_CHUNK_SIZE) {
            chunks.push(base64String.substring(i, i + BUNDLE_CHUNK_SIZE));
        }

        await storage.createFolderPath(endPoint, true);
        for (let i = 0; i < chunks.length; i++) {
            const chunkPath = makePath(endPoint, `${BUNDLE_PREFIX}${i}`);
            await storage.writeFile(chunkPath, chunks[i]);
        }

        const listing = await storage.getListing(endPoint) || [];
        const oldParts = listing.filter(item => item.name?.startsWith(BUNDLE_PREFIX));
        for (const part of oldParts) {
            const index = parseInt(part.name.split(BUNDLE_PREFIX)[1]);
            if (index >= chunks.length) {
                await storage.deleteFile(part.path);
            }
        }

        const newListing = await storage.getListing(endPoint) || [];
        const newParts = newListing.filter(item => item.name?.startsWith(BUNDLE_PREFIX));
        sortBundleParts(newParts);
        const newInventory = createInventoryFromParts(newParts);

        const cachePath = getCachePath(endPoint, 'bundle');
        const inventoryPath = getCachePath(endPoint, 'inventory');
        const versionPath = getCachePath(endPoint, 'version');

        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(newInventory));

        const versionInfo = {
            inventoryHash: JSON.stringify(newInventory),
            timestamp: Date.now()
        };
        await storage.writeFile(versionPath, JSON.stringify(versionInfo));
        await updateMasterManifest(endPoint, versionInfo);
    } catch (err) {
        console.error("[Bundle] Error saving bundle:", err);
        throw err;
    }
}


export async function scanLocal(path, ignore = [], listing = null, remote = null) {
    const bundle = {};
    if (!listing) {
        listing = await storage.getRecursiveList(path);
    }

    const files = listing.filter(item => item.type === "file");
    const pathRegex = new RegExp(`^${path}/`);

    await Promise.all(files.map(async (item) => {
        try {
            const relativePath = item.path.replace(pathRegex, "");

            if (ignore.some(pattern => relativePath.includes(pattern))) {
                return;
            }

            if (isBinaryFile(item.path)) {
                return;
            }

            const localMtime = item.mtimeMs || 0;
            const remoteItem = remote?.[relativePath];

            // Use remote content if timestamps match or remote is newer (with valid content)
            if (remoteItem?.content != null) {
                const remoteMtime = Math.floor(remoteItem.mtime || 0);
                const localFloorMtime = Math.floor(localMtime);

                if (remoteMtime === localFloorMtime || remoteMtime > localFloorMtime) {
                    bundle[relativePath] = {
                        content: remoteItem.content,
                        mtime: localMtime
                    };
                    return;
                }
            }

            const content = await storage.readFile(item.path);
            bundle[relativePath] = { content, mtime: localMtime };
        } catch (err) {
            if (err.code !== 'ENOENT' && !err.message?.includes('ENOENT')) {
                console.error(`[Bundle] Error reading ${item.path}:`, err);
            }
        }
    }));

    return bundle;
}

export function mergeBundles(remote = {}, local = {}, name = "") {
    const merged = { ...remote };
    let updateCount = 0;

    for (const [path, localItem] of Object.entries(local)) {
        const remoteItem = merged[path];

        if (remoteItem?.content != null && Math.floor(localItem.mtime) === Math.floor(remoteItem.mtime)) {
            continue;
        }

        if (!remoteItem || remoteItem.content == null || Math.floor(localItem.mtime) > Math.floor(remoteItem.mtime)) {
            if (remoteItem?.content != null) {
                if (remoteItem.content === localItem.content ||
                    normalizeContent(remoteItem.content) === normalizeContent(localItem.content)) {
                    continue;
                }
            }
            merged[path] = localItem;
            updateCount++;
        }
    }
    return { merged, updated: updateCount > 0 };
}

export async function applyBundle(root, bundle, listing = null, ignore = [], preserve = []) {
    if (!bundle) return { downloadCount: 0, listing: listing || [] };

    // Ensure root exists
    await storage.createFolderPath(root, true);

    // Check if bundle is corrupted (has null content)
    const bundleEntries = Object.entries(bundle);
    const nullContentCount = bundleEntries.filter(([_, item]) => item.content == null).length;
    const isBundleCorrupted = nullContentCount > 0;

    if (isBundleCorrupted) {
        console.warn(`[applyBundle] WARNING: Bundle is corrupted with ${nullContentCount}/${bundleEntries.length} files having null content. Skipping deletion to prevent data loss.`);
    }

    // Get local stats for safety check
    const localFiles = {};
    try {
        if (!listing) {
            listing = await storage.getRecursiveList(root);
        }
        for (const item of listing) {
            if (item.type === "file") {
                const relativePath = item.path.replace(new RegExp(`^${root}/`), "");
                // Filter out ignored files from localFiles
                if (!ignore.some(pattern => relativePath.includes(pattern))) {
                    localFiles[relativePath] = item.mtimeMs || 0;
                }
            }
        }
    } catch (err) {
        // Likely first run, folder empty
    }

    let downloadCount = 0;
    let skipCount = 0;
    let deleteCount = 0;
    let skipReasons = { timestampMatch: 0, localNewer: 0, contentMatch: 0 };

    // Process files in bundle (add/update)
    for (const [relativePath, item] of Object.entries(bundle)) {
        const fullPath = makePath(root, relativePath);
        const localMtime = localFiles[relativePath] || 0; // 0 if not exists

        // OPTIMIZATION: Trust exact timestamp matches (skip entirely)
        if (localMtime > 0 && Math.floor(item.mtime) === Math.floor(localMtime)) {
            // Timestamps match exactly - skip this file
            skipCount++;
            skipReasons.timestampMatch++;
            continue;
        }

        // Check content to decide what to do
        let shouldWrite = false;
        let contentChanged = true;

        if (localMtime > 0) {
            // File exists locally - check if content differs
            const localContent = await storage.readFile(fullPath);
            if (localContent === item.content) {
                contentChanged = false;
                skipCount++;
                skipReasons.contentMatch++;
            } else if (normalizeContent(localContent) === normalizeContent(item.content)) {
                contentChanged = false;
                skipCount++;
                skipReasons.contentMatch++;
            } else {
                // Content differs - decide based on timestamp
                if (Math.floor(item.mtime) > Math.floor(localMtime)) {
                    // Remote is newer - use remote
                    shouldWrite = true;
                } else {
                    // Local is newer or equal - keep local
                    // This could mean: local changes, or stale bundle timestamps
                    skipCount++;
                    skipReasons.localNewer++;
                }
            }
        } else {
            // File doesn't exist locally - always write
            shouldWrite = true;
        }

        if (shouldWrite) {
            // Skip if content is null or undefined
            if (item.content == null) {
                console.warn(`[applyBundle] Skipping ${relativePath} - content is null/undefined`);
                skipCount++;
                continue;
            }

            // Skip if path is malformed (contains duplicate path segments)
            if (fullPath.includes('local/shared/sessions') && relativePath.includes('local/shared/sessions')) {
                // Silently skip malformed paths from corrupted bundles
                skipCount++;
                continue;
            }

            // Check if file should be preserved (skip writing to keep local changes)
            // Only apply preservation if the file actually exists locally
            // Use exact filename matching to avoid false positives
            if (localMtime > 0 && preserve.some(pattern => relativePath.endsWith(pattern))) {
                skipCount++;
                continue;
            }

            try {
                const parentPath = fullPath.split("/").slice(0, -1).join("/");
                if (parentPath) {
                    await storage.createFolderPath(parentPath, true);
                }
                await storage.writeFile(fullPath, item.content);
                downloadCount++;
            } catch (err) {
                const errorStr = (err ? (err.code || err.message || "" + err) : "").toLowerCase();
                const isConflict = errorStr.includes('eisdir') || errorStr.includes('enotdir') || errorStr.includes('eexist');

                if (isConflict) {
                    try {
                        if (errorStr.includes('eisdir')) {
                            await storage.deleteFolder(fullPath);
                        } else {
                            const parentPath = fullPath.split("/").slice(0, -1).join("/");
                            if (await storage.exists(parentPath)) {
                                await storage.deleteFile(parentPath);
                            }
                        }

                        const parentPath = fullPath.split("/").slice(0, -1).join("/");
                        if (parentPath) {
                            await storage.createFolderPath(parentPath, true);
                        }
                        await storage.writeFile(fullPath, item.content);
                        downloadCount++;
                    } catch (retryErr) {
                        console.error(`[applyBundle] Failed to recover ${relativePath}:`, retryErr);
                    }
                } else {
                    console.error(`[applyBundle] Error writing ${relativePath}:`, err);
                }
            }
        }
    }

    // Delete local files that are no longer in the bundle
    // BUT: Skip deletion if bundle is corrupted (has null content)
    // AND: Avoid mass deletions (more than 50% of local files) if we have a significant number of files
    if (!isBundleCorrupted) {
        const bundleFiles = new Set(Object.keys(bundle));
        const toDelete = [];

        for (const relativePath of Object.keys(localFiles)) {
            if (!bundleFiles.has(relativePath)) {
                // Check if file should be ignored
                if (ignore.some(pattern => relativePath.includes(pattern))) {
                    continue;
                }
                // Check if file should be preserved
                // Use exact filename matching to avoid false positives
                if (preserve.some(pattern => relativePath.endsWith(pattern))) {
                    continue;
                }
                toDelete.push(relativePath);
            }
        }

        const localFileCount = Object.keys(localFiles).length;
        if (localFileCount > 20 && toDelete.length > localFileCount * 0.5) {
            console.warn(`[applyBundle] SAFETY TRIGGERED: Attempting to delete ${toDelete.length}/${localFileCount} files (${Math.round(toDelete.length / localFileCount * 100)}%). This looks like a corrupted sync. Skipping deletion phase.`);
            return { downloadCount, listing, isBundleCorrupted };
        }

        if (toDelete.length > 0) {
            console.log(`[applyBundle] Cleaning up ${toDelete.length} removed files...`);
            for (const relativePath of toDelete) {
                const fullPath = makePath(root, relativePath);
                try {
                    if (await storage.exists(fullPath)) {
                        await storage.deleteFile(fullPath);
                        deleteCount++;
                    }
                } catch (err) {
                    console.error(`[applyBundle] Error deleting ${relativePath}:`, err);
                }
            }
        }
    }

    return { downloadCount: downloadCount + deleteCount, listing, isBundleCorrupted };
}
