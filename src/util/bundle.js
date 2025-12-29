import storage from "@util/storage";
import pako from "pako";
import { makePath, isBinaryFile } from "@util/path";
import { Base64 } from "js-base64";

const BUNDLE_CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB limit to stay under 4MB API limit
const BUNDLE_PREFIX = "bundle.gz.part.";

// Memory caches removed to reduce memory usage

/**
 * Generate a hash from bundle inventory for quick comparison
 * @param {Array} inventory - Array of {name, mtime} objects
 * @returns {string} Hash string
 */
function generateInventoryHash(inventory) {
    if (!inventory || !inventory.length) return "";

    // Create a stable string representation
    const stable = inventory
        .map(item => `${item.name}:${Math.floor(item.mtime || 0)}`)
        .sort()
        .join("|");

    // Simple hash function (good enough for change detection)
    let hash = 0;
    for (let i = 0; i < stable.length; i++) {
        const char = stable.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

// Metadata cache functions removed to reduce memory usage

/**
 * Get or create master manifest with all bundle versions
 * This avoids making individual API calls for each bundle
 */
async function getMasterManifest() {
    const manifestPath = 'local/cache/_bundle_manifest.json';
    try {
        if (await storage.exists(manifestPath)) {
            const manifestStr = await storage.readFile(manifestPath);
            return JSON.parse(manifestStr);
        }
    } catch (err) {
        console.error("getMasterManifest: Error reading manifest:", err);
    }
    return {};
}

/**
 * Update master manifest with bundle version
 */
async function updateMasterManifest(endPoint, versionInfo) {
    const manifestPath = 'local/cache/_bundle_manifest.json';
    try {
        const manifest = await getMasterManifest();
        manifest[endPoint] = versionInfo;
        await storage.writeFile(manifestPath, JSON.stringify(manifest));
    } catch (err) {
        console.error("updateMasterManifest: Error updating manifest:", err);
    }
}

/**
 * Check if bundle version has changed using master manifest
 * @param {string} endPoint - Bundle endpoint
 * @param {Array} listing - Remote listing (optional)
 * @returns {Object} { changed: boolean, versionInfo: object }
 */
export async function checkBundleVersion(endPoint, listing = null) {
    try {
        if (!listing) {
            listing = await storage.getListing(endPoint) || [];
        }
        const bundleParts = listing.filter(item => item.name && item.name.startsWith(BUNDLE_PREFIX));

        if (!bundleParts.length) {
            return { changed: true, versionInfo: null };
        }

        // Sort parts by index
        bundleParts.sort((a, b) => {
            const indexA = parseInt(a.name.split(BUNDLE_PREFIX)[1]);
            const indexB = parseInt(b.name.split(BUNDLE_PREFIX)[1]);
            return indexA - indexB;
        });

        // Create inventory signature
        const inventory = bundleParts.map(p => ({
            name: p.name,
            mtime: p.mtimeMs || 0
        }));

        const currentInventoryHash = JSON.stringify(inventory);

        // Check master manifest instead of individual version files
        const manifest = await getMasterManifest();
        const cachedVersion = manifest[endPoint];

        if (cachedVersion && cachedVersion.inventoryHash === currentInventoryHash) {
            // Version matches - no changes
            return { changed: false, versionInfo: cachedVersion };
        }

        // Version doesn't match or doesn't exist
        return { changed: true, versionInfo: { inventoryHash: currentInventoryHash, timestamp: Date.now() } };
    } catch (err) {
        console.error("checkBundleVersion: Error checking version:", err);
        // On error, assume changed to be safe
        return { changed: true, versionInfo: null };
    }
}


function normalizeContent(content) {
    const sortKeys = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(sortKeys);
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).sort().reduce((sorted, key) => {
                sorted[key] = sortKeys(obj[key]);
                return sorted;
            }, {});
        }
        return obj;
    };

    if (typeof content === "string") {
        try {
            const obj = JSON.parse(content);
            return JSON.stringify(sortKeys(obj), null, 4);
        } catch (e) {
            return content;
        }
    }
    return JSON.stringify(sortKeys(content), null, 4);
}

export async function getRemoteBundle(endPoint, listing = null) {
    if (!listing) {
        listing = await storage.getListing(endPoint) || [];
    }
    const bundleParts = listing.filter(item => item.name && item.name.startsWith(BUNDLE_PREFIX));

    if (!bundleParts.length) {
        console.warn(`[getRemoteBundle] No bundle parts found for ${endPoint}`);
        return null;
    }

    // Sort parts by index
    bundleParts.sort((a, b) => {
        const indexA = parseInt(a.name.split(BUNDLE_PREFIX)[1]);
        const indexB = parseInt(b.name.split(BUNDLE_PREFIX)[1]);
        return indexA - indexB;
    });

    // Create inventory signature (name, mtime)
    const inventory = bundleParts.map(p => ({
        name: p.name,
        mtime: p.mtimeMs || 0
    }));

    // VERSION-BASED OPTIMIZATION: Check if remote version matches cached version
    const versionPath = `local/cache/${endPoint}_version.json`;
    const cachePath = `local/cache/${endPoint}_bundle.json`;
    const inventoryPath = `local/cache/${endPoint}_inventory.json`;

    try {
        // Read cached version info
        if (await storage.exists(versionPath)) {
            const versionStr = await storage.readFile(versionPath);
            const versionInfo = JSON.parse(versionStr);

            // Simple version check - if inventory matches, use cache
            const currentInventoryHash = JSON.stringify(inventory);
            if (versionInfo.inventoryHash === currentInventoryHash) {
                // Version matches - use cached bundle without any processing
                if (await storage.exists(cachePath)) {
                    const cachedBundleStr = await storage.readFile(cachePath);
                    if (cachedBundleStr) {
                        return JSON.parse(cachedBundleStr);
                    }
                }
            }
        }
    } catch (err) {
        console.error("getRemoteBundle: Version check failed, proceeding with download:", err);
    }

    // Download and decompress bundle
    const parts = [];
    for (const part of bundleParts) {
        try {
            const content = await storage.readFile(part.path);
            if (content) {
                // Trim whitespace to avoid Base64 corruption
                parts.push(content.trim());
            } else {
                console.error(`[getRemoteBundle] Empty content for part ${part.path}`);
            }
        } catch (err) {
            console.error(`[getRemoteBundle] Error reading part ${part.path}:`, err);
        }
    }

    if (!parts.length) {
        return null;
    }

    // Join parts (Base64 strings) -> Single Base64 String -> Uint8Array -> Gunzip -> JSON String -> Object
    try {
        const joinedBase64 = parts.join("");

        // Validate Base64 string
        if (!joinedBase64 || joinedBase64.length === 0) {
            console.error("getRemoteBundle: Empty Base64 string");
            return null;
        }

        const binaryString = Base64.atob(joinedBase64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));

        // Validate gzip header (should start with 0x1f 0x8b)
        if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
            console.error("getRemoteBundle: Invalid gzip header. First bytes:", bytes.slice(0, 10));
            // Clear corrupted cache
            try {
                if (await storage.exists(cachePath)) {
                    await storage.deleteFile(cachePath);
                }
                if (await storage.exists(versionPath)) {
                    await storage.deleteFile(versionPath);
                }
            } catch (cleanupErr) {
                console.error("getRemoteBundle: Error cleaning up corrupted cache:", cleanupErr);
            }
            return null;
        }

        const jsonString = pako.ungzip(bytes, { to: "string" });

        // Update Cache
        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(inventory));

        // Update master manifest for fast future checks
        const inventoryHash = JSON.stringify(inventory);
        const versionInfo = {
            inventoryHash,
            timestamp: Date.now()
        };
        await updateMasterManifest(endPoint, versionInfo);

        return JSON.parse(jsonString);
    } catch (err) {
        console.error("getRemoteBundle: Error parsing bundle:", err);
        console.error("getRemoteBundle: Bundle parts count:", parts.length, "Total length:", parts.join("").length);

        // Clear corrupted cache on any error
        try {
            if (await storage.exists(cachePath)) {
                await storage.deleteFile(cachePath);
            }
            if (await storage.exists(versionPath)) {
                await storage.deleteFile(versionPath);
            }
        } catch (cleanupErr) {
            console.error("getRemoteBundle: Error cleaning up corrupted cache:", cleanupErr);
        }

        return null;
    }
}


export async function saveRemoteBundle(endPoint, bundle) {

    try {
        const jsonString = JSON.stringify(bundle);
        const bytes = pako.gzip(jsonString);
        // Convert to Base64 to safely transport via JSON API
        const base64String = Base64.fromUint8Array(bytes);

        const chunks = [];
        for (let i = 0; i < base64String.length; i += BUNDLE_CHUNK_SIZE) {
            chunks.push(base64String.substring(i, i + BUNDLE_CHUNK_SIZE));
        }



        // Upload new chunks
        await storage.createFolderPath(endPoint, true);
        for (let i = 0; i < chunks.length; i++) {
            const chunkName = `${BUNDLE_PREFIX}${i}`;
            const chunkPath = makePath(endPoint, chunkName);

            await storage.writeFile(chunkPath, chunks[i]);
        }

        // Clean up old chunks (logic: list again, if any part index >= chunks.length, delete it)
        const listing = await storage.getListing(endPoint) || [];
        const oldParts = listing.filter(item => item.name && item.name.startsWith(BUNDLE_PREFIX));
        for (const part of oldParts) {
            const index = parseInt(part.name.split(BUNDLE_PREFIX)[1]);
            if (index >= chunks.length) {
                await storage.deleteFile(part.path);
            }
        }

        // Refresh cache after upload to prevent next sync from downloading it

        const newListing = await storage.getListing(endPoint) || [];
        const newParts = newListing.filter(item => item.name && item.name.startsWith(BUNDLE_PREFIX));
        newParts.sort((a, b) => {
            const indexA = parseInt(a.name.split(BUNDLE_PREFIX)[1]);
            const indexB = parseInt(b.name.split(BUNDLE_PREFIX)[1]);
            return indexA - indexB;
        });

        const newInventory = newParts.map(p => ({
            name: p.name,
            mtime: p.mtimeMs || 0
        }));

        const cachePath = `local/cache/${endPoint}_bundle.json`;
        const inventoryPath = `local/cache/${endPoint}_inventory.json`;
        const versionPath = `local/cache/${endPoint}_version.json`;

        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(newInventory));

        // Update master manifest for fast future checks
        const inventoryHash = JSON.stringify(newInventory);
        const versionInfo = {
            inventoryHash,
            timestamp: Date.now()
        };
        await updateMasterManifest(endPoint, versionInfo);


    } catch (err) {
        console.error("saveRemoteBundle: Error saving bundle:", err);
        throw err;
    }
}


export async function scanLocal(path, ignore = [], listing = null, remote = null) {
    const bundle = {};
    if (!listing) {
        listing = await storage.getRecursiveList(path);
    }

    const files = listing.filter(item => item.type === "file");

    await Promise.all(files.map(async (item) => {
        try {
            // Store relative path
            const relativePath = item.path.replace(new RegExp(`^${path}/`), "");

            // Check ignore list
            if (ignore.some(pattern => relativePath.includes(pattern))) {
                return;
            }

            // Skip binary files
            if (isBinaryFile(item.path)) {
                return;
            }

            const localMtime = item.mtimeMs || 0;
            const remoteItem = remote && remote[relativePath];

            // OPTIMIZATION 1: Trust exact timestamp matches (skip content read entirely)
            // BUT: Only if remote content is not null (to handle corrupted bundles)
            if (remoteItem && remoteItem.mtime && remoteItem.content != null && Math.floor(remoteItem.mtime) === Math.floor(localMtime)) {
                bundle[relativePath] = {
                    content: remoteItem.content,
                    mtime: localMtime  // Use local mtime to ensure consistency
                };
                return;
            }

            // OPTIMIZATION 2: Reuse remote content if remote is newer (avoid read)
            // BUT: Only if remote content is not null (to handle corrupted bundles)
            if (remoteItem && remoteItem.mtime && remoteItem.content != null && Math.floor(remoteItem.mtime) > Math.floor(localMtime)) {
                bundle[relativePath] = {
                    content: remoteItem.content,
                    mtime: localMtime  // Use local mtime to ensure consistency
                };
                return;
            }

            // Only read content if we don't have a valid remote version
            const content = await storage.readFile(item.path);
            bundle[relativePath] = {
                content,
                mtime: localMtime
            };
        } catch (err) {
            if (err.code === 'ENOENT' || (err.message && err.message.includes('ENOENT'))) {
                // File deleted or missing, ignore
            } else {
                console.error(`scanLocal: Error reading ${item.path}:`, err);
            }
        }
    }));

    return bundle;
}

export function mergeBundles(remote, local, name = "") {
    if (!remote) remote = {};
    if (!local) local = {};

    const merged = { ...remote };
    let updateCount = 0;

    for (const [path, localItem] of Object.entries(local)) {
        const remoteItem = merged[path];

        // OPTIMIZATION: Trust exact timestamp matches (skip content comparison)
        // BUT: Only if remote content is not null (to handle corrupted bundles)
        if (remoteItem && remoteItem.content != null && Math.floor(localItem.mtime) === Math.floor(remoteItem.mtime)) {
            // Timestamps match exactly - trust that content is the same
            continue;
        }

        if (!remoteItem || (remoteItem && remoteItem.content == null) || Math.floor(localItem.mtime) > Math.floor(remoteItem.mtime)) {
            // Check content equality to avoid redundant updates
            if (remoteItem && remoteItem.content != null) {
                // Quick check: exact content match
                if (remoteItem.content === localItem.content) {
                    continue;
                }
                // Expensive check: normalized content match (only if needed)
                if (normalizeContent(remoteItem.content) === normalizeContent(localItem.content)) {
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
            if (localMtime > 0 && preserve.some(pattern => relativePath.includes(pattern))) {
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
                if (preserve.some(pattern => relativePath.includes(pattern))) {
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
