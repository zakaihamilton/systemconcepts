import storage from "@util/storage";
import pako from "pako";
import { makePath } from "@util/path";
import { Base64 } from "js-base64";

const BUNDLE_CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB limit to stay under 4MB API limit
const BUNDLE_PREFIX = "bundle.gz.part.";

export async function getRemoteBundle(endPoint) {
    console.log(`getRemoteBundle: Fetching bundle from ${endPoint}...`);
    const listing = await storage.getListing(endPoint);
    const bundleParts = listing.filter(item => item.name.startsWith(BUNDLE_PREFIX));

    if (!bundleParts.length) {
        console.log("getRemoteBundle: No bundle found.");
        return null;
    }

    // Sort parts by index
    bundleParts.sort((a, b) => {
        const indexA = parseInt(a.name.split(BUNDLE_PREFIX)[1]);
        const indexB = parseInt(b.name.split(BUNDLE_PREFIX)[1]);
        return indexA - indexB;
    });

    // Download parts
    const parts = [];
    for (const part of bundleParts) {
        console.log(`getRemoteBundle: Downloading ${part.name}...`);
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
        const bundle = JSON.parse(jsonString);
        console.log(`getRemoteBundle: Successfully fetched and parsed bundle with ${Object.keys(bundle).length} items.`);
        return bundle;
    } catch (err) {
        console.error("getRemoteBundle: Error parsing bundle:", err);
        return null;
    }
}

export async function saveRemoteBundle(endPoint, bundle) {
    console.log(`saveRemoteBundle: Saving bundle to ${endPoint}...`);
    try {
        const jsonString = JSON.stringify(bundle);
        const bytes = pako.gzip(jsonString);
        // Convert to Base64 to safely transport via JSON API
        const base64String = Base64.fromUint8Array(bytes);

        const chunks = [];
        for (let i = 0; i < base64String.length; i += BUNDLE_CHUNK_SIZE) {
            chunks.push(base64String.substring(i, i + BUNDLE_CHUNK_SIZE));
        }

        console.log(`saveRemoteBundle: Compressed size: ${base64String.length} bytes. Chunks: ${chunks.length}`);

        // Upload new chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunkName = `${BUNDLE_PREFIX}${i}`;
            const chunkPath = makePath(endPoint, chunkName);
            console.log(`saveRemoteBundle: Uploading ${chunkName}...`);
            await storage.writeFile(chunkPath, chunks[i]);
        }

        // Clean up old chunks (logic: list again, if any part index >= chunks.length, delete it)
        const listing = await storage.getListing(endPoint);
        const oldParts = listing.filter(item => item.name.startsWith(BUNDLE_PREFIX));
        for (const part of oldParts) {
            const index = parseInt(part.name.split(BUNDLE_PREFIX)[1]);
            if (index >= chunks.length) {
                console.log(`saveRemoteBundle: Deleting old chunk ${part.name}...`);
                await storage.deleteFile(part.path);
            }
        }

    } catch (err) {
        console.error("saveRemoteBundle: Error saving bundle:", err);
        throw err;
    }
}

export async function scanLocal(path) {
    console.log(`scanLocal: Scanning ${path}...`);
    const bundle = {};
    const listing = await storage.getRecursiveList(path);

    for (const item of listing) {
        if (item.type === "file") {
            try {
                const content = await storage.readFile(item.path);
                // Store relative path
                // item.path is /local/personal/foo.txt
                // relative is foo.txt
                const relativePath = item.path.replace(new RegExp(`^${path}/`), "");
                bundle[relativePath] = {
                    content,
                    mtime: item.mtimeMs || 0
                };
            } catch (err) {
                console.error(`scanLocal: Error reading ${item.path}:`, err);
            }
        }
    }
    console.log(`scanLocal: Found ${Object.keys(bundle).length} files.`);
    return bundle;
}

export function mergeBundles(remote, local) {
    console.log("mergeBundles: Merging remote and local bundles...");
    if (!remote) remote = {};
    if (!local) local = {};

    const merged = { ...remote };
    let updateCount = 0;

    for (const [path, localItem] of Object.entries(local)) {
        const remoteItem = merged[path];
        if (!remoteItem || localItem.mtime > remoteItem.mtime) {
            merged[path] = localItem;
            // console.log(`mergeBundles: Update ${path} (Local newer)`);
            updateCount++;
        }
    }
    console.log(`mergeBundles: Merged. Updated ${updateCount} items from local.`);
    return merged;
}

export async function applyBundle(root, bundle) {
    console.log(`applyBundle: Applying bundle to ${root}...`);
    if (!bundle) return;

    // Ensure root exists
    await storage.createFolderPath(root, true);

    // Get local stats for safety check
    const localFiles = {};
    try {
        const listing = await storage.getRecursiveList(root);
        for (const item of listing) {
            if (item.type === "file") {
                const relativePath = item.path.replace(new RegExp(`^${root}/`), "");
                localFiles[relativePath] = item.mtimeMs || 0;
            }
        }
    } catch (err) {
        // Likely first run, folder empty
    }

    let updateCount = 0;
    for (const [relativePath, item] of Object.entries(bundle)) {
        const fullPath = makePath(root, relativePath);
        const localMtime = localFiles[relativePath] || 0; // 0 if not exists

        // Strict > check. If equal, don't write (saves IO).
        // If local is newer, don't write (saves local work).
        if (item.mtime > localMtime) {
            await storage.createFolderPath(fullPath);
            await storage.writeFile(fullPath, item.content);
            updateCount++;
        }
    }
    console.log(`applyBundle: Finished. Updated ${updateCount} files.`);
}
