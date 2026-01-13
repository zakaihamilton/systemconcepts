import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, FILES_MANIFEST_GZ, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile } from "../bundle";

/**
 * Step 3: Download the files.json or generate it from listing
 */
export async function syncManifest(remotePath = SYNC_BASE_PATH) {
    const start = performance.now();
    addSyncLog("Step 3: Syncing manifest...", "info");

    const remoteManifestPathGz = makePath(remotePath, FILES_MANIFEST_GZ);
    const remoteManifestPathJson = makePath(remotePath, FILES_MANIFEST);

    try {
        let remoteManifest = [];

        // 1. Try files.gz
        if (await storage.exists(remoteManifestPathGz)) {
            remoteManifest = await readCompressedFile(remoteManifestPathGz) || [];
            console.log(`[Sync] Found ${remoteManifestPathGz}, count: ${remoteManifest.length}`);
        }
        // 2. Try files.json
        if (remoteManifest.length === 0 && await storage.exists(remoteManifestPathJson)) {
            const content = await storage.readFile(remoteManifestPathJson);
            if (content) {
                try {
                    remoteManifest = JSON.parse(content);
                    console.log(`[Sync] Found ${remoteManifestPathJson}, count: ${remoteManifest.length}`);
                } catch (e) {
                    console.error("[Sync] Error parsing remote manifest", e);
                }
            }
        }

        // 3. Fallback: Generate from listing if still empty
        if (remoteManifest.length === 0) {
            console.log(`[Sync] Manifest empty or missing, checking ${remotePath} for files...`);
            const listing = await storage.getRecursiveList(remotePath);
            console.log(`[Sync] Recursive listing found ${listing.length} items in ${remotePath}`);

            if (listing.length > 0) {
                console.log("[Sync] Listing Sample:", JSON.stringify(listing.slice(0, 5)));
            }

            remoteManifest = listing.filter(item => {
                const isDir = item.type === "dir" || item.stat?.type === "dir" || item.name.endsWith("/");
                const isManifest = item.name === FILES_MANIFEST || item.name === FILES_MANIFEST_GZ;
                const isDSStore = item.name.endsWith(".DS_Store");
                const include = !isDir && !isManifest && !isDSStore;
                if (!include && !isManifest && !isDSStore) {
                    console.log(`[Sync] Filtering out: ${item.name} (isDir=${isDir})`);
                }
                return include;
            }).map(item => {
                const prefix = makePath(remotePath);
                let relPath = item.path.substring(prefix.length);
                if (relPath.startsWith("/")) {
                    relPath = relPath.slice(1);
                }
                if (relPath.endsWith(".gz")) {
                    relPath = relPath.slice(0, -3);
                }
                if (!relPath.startsWith("/")) {
                    relPath = "/" + relPath;
                }
                return {
                    path: relPath,
                    size: item.size || 0,
                    hash: null, // Hash unknown
                    version: Math.max(1, item.mtimeMs || 1).toString()
                };
            });
            console.log(`[Sync] After filtering, remoteManifest has ${remoteManifest.length} files`);
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Synced manifest (${remoteManifest.length} files) in ${duration}s`, "info");
        return remoteManifest;
    } catch (err) {
        console.error("[Sync] Step 3 error:", err);
        throw err;
    }
}
