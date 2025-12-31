import storage from "@util/storage";
import { SYNC_BASE_PATH, FILES_MANIFEST_GZ } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile } from "../bundle";

/**
 * Step 3: Download the files.json and compare it with the local files.json
 */
export async function syncManifest(localManifest) {
    const start = performance.now();
    addSyncLog("Step 3: Syncing manifest...", "info");

    const remoteManifestPath = `${SYNC_BASE_PATH}/${FILES_MANIFEST_GZ}`;

    try {
        let remoteManifest = [];
        if (await storage.exists(remoteManifestPath)) {
            remoteManifest = await readCompressedFile(remoteManifestPath) || [];
        }

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 3 finished in ${duration}ms. Remote manifest size: ${remoteManifest.length}`);
        return remoteManifest;
    } catch (err) {
        console.error("[Sync] Step 3 error:", err);
        throw err;
    }
}
