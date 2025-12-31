import { makePath } from "@util/path";
import { SYNC_BASE_PATH, FILES_MANIFEST_GZ } from "../constants";
import { addSyncLog } from "../logs";
import { writeCompressedFile } from "../bundle";

/**
 * Step 7: Upload the final manifest file
 */
export async function uploadManifest(remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 7: Uploading manifest...", "info");

    try {
        const remoteManifestPath = makePath(SYNC_BASE_PATH, FILES_MANIFEST_GZ);
        await writeCompressedFile(remoteManifestPath, remoteManifest);

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 7 finished in ${duration}ms. Manifest uploaded.`);
    } catch (err) {
        console.error("[Sync] Step 7 error:", err);
        throw err;
    }
}
