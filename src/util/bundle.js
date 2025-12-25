import storage from "@util/storage";
import pako from "pako";
import { makePath, isBinaryFile } from "@util/path";
import { Base64 } from "js-base64";

const BUNDLE_CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB limit to stay under 4MB API limit
const BUNDLE_PREFIX = "bundle.gz.part.";

// In-memory cache to avoid expensive IndexedDB reads
const bundleMemoryCache = new Map();

// Metadata cache for quick bundle comparison
const metadataCache = new Map();

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

/**
 * Get bundle metadata for quick comparison
 * @param {string} endPoint - Bundle endpoint
 * @returns {Object|null} Metadata object with hash and timestamp
 */
async function getBundleMetadata(endPoint) {
    try {
        const metadataPath = `${endPoint}/bundle.meta.json`;

        // Check memory cache first
        if (metadataCache.has(endPoint)) {
            return metadataCache.get(endPoint);
        }

        // Try to read from storage
        if (await storage.exists(metadataPath)) {
            const metadataStr = await storage.readFile(metadataPath);
            const metadata = JSON.parse(metadataStr);
            metadataCache.set(endPoint, metadata);
            return metadata;
        }

        return null;
    } catch (err) {
        console.error(`getBundleMetadata: Error reading metadata for ${endPoint}:`, err);
        return null;
    }
}

/**
 * Save bundle metadata for quick future comparisons
 * @param {string} endPoint - Bundle endpoint
 * @param {Object} metadata - Metadata object to save
 */
async function saveBundleMetadata(endPoint, metadata) {
    try {
        const metadataPath = `${endPoint}/bundle.meta.json`;
        await storage.createFolderPath(metadataPath);
        await storage.writeFile(metadataPath, JSON.stringify(metadata));
        metadataCache.set(endPoint, metadata);
    } catch (err) {
        console.error(`saveBundleMetadata: Error saving metadata for ${endPoint}:`, err);
    }
}

/**
 * Compare local cached metadata with remote inventory
 * @param {Object} cachedMetadata - Cached metadata
 * @param {Array} remoteInventory - Remote bundle inventory
 * @returns {boolean} True if metadata indicates bundle has changed
 */
function hasMetadataChanged(cachedMetadata, remoteInventory) {
    if (!cachedMetadata) return true;

    const remoteHash = generateInventoryHash(remoteInventory);
    return cachedMetadata.hash !== remoteHash;
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
    // AGGRESSIVE CACHE: If we have it in memory, return it immediately (no network calls)
    if (bundleMemoryCache.has(endPoint)) {
        return bundleMemoryCache.get(endPoint).bundle;
    }

    if (!listing) {
        listing = await storage.getListing(endPoint) || [];
    }
    const bundleParts = listing.filter(item => item.name && item.name.startsWith(BUNDLE_PREFIX));

    if (!bundleParts.length) {
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

    // FAST PATH: Check metadata first
    const cachedMetadata = await getBundleMetadata(endPoint);
    if (!hasMetadataChanged(cachedMetadata, inventory)) {
        // Metadata matches - try to use cached bundle
        const cachePath = `local/cache/${endPoint}_bundle.json`;
        try {
            if (await storage.exists(cachePath)) {
                const cachedBundleStr = await storage.readFile(cachePath);
                if (cachedBundleStr) {
                    const bundle = JSON.parse(cachedBundleStr);
                    // Store in memory cache
                    bundleMemoryCache.set(endPoint, { inventory, bundle });
                    return bundle;
                }
            }
        } catch (err) {
            console.error("getRemoteBundle: Fast path failed, falling back to download:", err);
        }
    }

    const cachePath = `local/cache/${endPoint}_bundle.json`;
    const inventoryPath = `local/cache/${endPoint}_inventory.json`;

    try {
        let cachedInventoryStr = null;
        if (await storage.exists(inventoryPath)) {
            cachedInventoryStr = await storage.readFile(inventoryPath);
        }
        const cachedInventory = cachedInventoryStr ? JSON.parse(cachedInventoryStr) : [];

        if (JSON.stringify(inventory) === JSON.stringify(cachedInventory)) {
            const cachedBundleStr = await storage.readFile(cachePath);
            if (cachedBundleStr) {
                const bundle = JSON.parse(cachedBundleStr);
                // Store in memory cache
                bundleMemoryCache.set(endPoint, { inventory, bundle });
                return bundle;
            }
        }
    } catch (err) {
        // Cache miss or error, proceed to download
        console.error("getRemoteBundle: Cache miss or invalid (error).", err);
    }

    // Download parts
    const parts = [];
    for (const part of bundleParts) {

        const content = await storage.readFile(part.path);
        if (content) {
            parts.push(content);
        }
    }

    if (!parts.length) {
        return null;
    }

    // Join parts (Base64 strings) -> Single Base64 String -> Uint8Array -> Gunzip -> JSON String -> Object
    try {
        const joinedBase64 = parts.join("");
        const binaryString = Base64.atob(joinedBase64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const jsonString = pako.ungzip(bytes, { to: "string" });

        // Update Cache
        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(inventory));

        const bundle = JSON.parse(jsonString);

        // Save metadata for future fast-path checks
        const metadata = {
            hash: generateInventoryHash(inventory),
            timestamp: Date.now(),
            fileCount: Object.keys(bundle).length
        };
        await saveBundleMetadata(endPoint, metadata);

        // Store in memory cache
        bundleMemoryCache.set(endPoint, { inventory, bundle });
        return bundle;
    } catch (err) {
        console.error("getRemoteBundle: Error parsing bundle:", err);
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

        await storage.createFolderPath(cachePath);
        await storage.writeFile(cachePath, jsonString);
        await storage.writeFile(inventoryPath, JSON.stringify(newInventory));

        // Save metadata for future fast-path checks
        const metadata = {
            hash: generateInventoryHash(newInventory),
            timestamp: Date.now(),
            fileCount: Object.keys(bundle).length
        };
        await saveBundleMetadata(endPoint, metadata);

        // Update memory cache
        bundleMemoryCache.set(endPoint, { inventory: newInventory, bundle });

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
            if (remoteItem && remoteItem.mtime && Math.floor(remoteItem.mtime) === Math.floor(localMtime)) {
                bundle[relativePath] = {
                    content: remoteItem.content,
                    mtime: localMtime  // Use local mtime to ensure consistency
                };
                return;
            }

            // OPTIMIZATION 2: Reuse remote content if remote is newer (avoid read)
            if (remoteItem && remoteItem.mtime && Math.floor(remoteItem.mtime) > Math.floor(localMtime)) {
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
            console.error(`scanLocal: Error reading ${item.path}:`, err);
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
        if (remoteItem && Math.floor(localItem.mtime) === Math.floor(remoteItem.mtime)) {
            // Timestamps match exactly - trust that content is the same
            continue;
        }

        if (!remoteItem || Math.floor(localItem.mtime) > Math.floor(remoteItem.mtime)) {
            // Check content equality to avoid redundant updates
            if (remoteItem) {
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
    if (updateCount > 0) {
        console.log(`mergeBundles: Merged. Updated ${updateCount} items from local for ${name}.`);
    }
    return { merged, updated: updateCount > 0 };
}

export async function applyBundle(root, bundle, listing = null) {
    if (!bundle) return { downloadCount: 0, listing: listing || [] };

    // Ensure root exists
    await storage.createFolderPath(root, true);

    // Get local stats for safety check
    const localFiles = {};
    try {
        if (!listing) {
            listing = await storage.getRecursiveList(root);
        }
        for (const item of listing) {
            if (item.type === "file") {
                const relativePath = item.path.replace(new RegExp(`^${root}/`), "");
                localFiles[relativePath] = item.mtimeMs || 0;
            }
        }
    } catch (err) {
        // Likely first run, folder empty
    }

    let downloadCount = 0;
    for (const [relativePath, item] of Object.entries(bundle)) {
        const fullPath = makePath(root, relativePath);
        const localMtime = localFiles[relativePath] || 0; // 0 if not exists

        // OPTIMIZATION: Trust exact timestamp matches (skip entirely)
        if (localMtime > 0 && Math.floor(item.mtime) === Math.floor(localMtime)) {
            // Timestamps match exactly - skip this file
            continue;
        }

        // Strict > check. If equal, don't write (saves IO).
        // If local is newer, don't write (saves local work).
        if (Math.floor(item.mtime) > Math.floor(localMtime)) {
            // Check content equality to avoid redundant updates (breaking the timestamp loop)
            let contentChanged = true;
            if (localMtime > 0) {
                const localContent = await storage.readFile(fullPath);
                if (localContent === item.content) {
                    contentChanged = false;
                } else if (normalizeContent(localContent) === normalizeContent(item.content)) {
                    contentChanged = false;
                }
            }

            if (contentChanged) {
                await storage.createFolderPath(fullPath);
                await storage.writeFile(fullPath, item.content);
                downloadCount++;
            }
        }
    }
    if (downloadCount > 0) {
        console.log(`applyBundle: Finished. Updated ${downloadCount} files for ${root}.`);
    }
    return { downloadCount, listing };
}
