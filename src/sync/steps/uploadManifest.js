import { makePath } from "@util/path";
import { SYNC_BASE_PATH, FILES_MANIFEST_GZ } from "../constants";
import { addSyncLog } from "../logs";
import { writeCompressedFile } from "../bundle";
import Cookies from "js-cookie";

/**
 * Step 7: Upload the final manifest file
 */
export async function uploadManifest(remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 7: Uploading manifest...", "info");

    try {
        const remoteManifestPath = makePath(SYNC_BASE_PATH, FILES_MANIFEST_GZ);
        await writeCompressedFile(remoteManifestPath, remoteManifest);

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Uploaded manifest in ${duration}s`, "info");
    } catch (err) {
        if (err.status === 403 || err === 403 || err.message?.includes("ACCESS_DENIED")) {
            const role = Cookies.get("role");
            if (role === "visitor") {
                addSyncLog("Visitor access restricted. Please contact Administrator for write access.", "warning");
            } else {
                addSyncLog("Skipping manifest upload (read-only access)", "warning");
            }
            return;
        }
        console.error("[Sync] Step 7 error:", err);
        throw err;
    }
}
