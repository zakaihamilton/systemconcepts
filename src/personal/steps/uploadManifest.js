
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";
import { writeCompressedFile } from "@sync/bundle";

/**
 * Step 7: Upload the final manifest to remote
 */
export async function uploadManifest(remoteManifest, userid) {
    const start = performance.now();
    addSyncLog("[Personal] Step 7: Uploading manifest...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);
    const remoteManifestPath = makePath(basePath, PERSONAL_MANIFEST);

    // Prevent uploading empty manifest to avoid corruption
    const fileCount = Object.keys(remoteManifest || {}).length;
    if (fileCount === 0) {
        addSyncLog("[Personal] Skipping manifest upload (empty manifest)", "info");
        return;
    }

    try {
        await writeCompressedFile(remoteManifestPath, remoteManifest);

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Uploaded manifest in ${duration}s`, "info");
    } catch (err) {
        console.error("[Personal Sync] Step 7 error:", err);
        throw err;
    }
}
