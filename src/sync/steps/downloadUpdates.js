import storage from "@util/storage";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { updateManifestEntry } from "../manifest";

/**
 * Step 4: If the version is higher on the remote file we download the corresponding .gz file and decompress it and replace the local file
 */
export async function downloadUpdates(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 4: Downloading updates...", "info");

    let updatedLocalManifest = [...localManifest];
    let downloadCount = 0;

    try {
        const localMap = new Map(localManifest.map(f => [f.path, f]));

        for (const remoteFile of remoteManifest) {
            const localFile = localMap.get(remoteFile.path);

            const fileBasename = remoteFile.path;
            const localFilePath = `${LOCAL_SYNC_PATH}/${fileBasename}`;
            const remoteFilePath = `${SYNC_BASE_PATH}/${fileBasename}.gz`;

            const remoteVer = parseInt(remoteFile.version);
            const localVer = localFile ? parseInt(localFile.version) : 0;

            if (remoteVer > localVer) {
                addSyncLog(`Downloading ${fileBasename} (v${remoteVer})...`, "info");

                // Download and decompress
                const data = await readCompressedFile(remoteFilePath);
                if (data) {
                    // Write to local
                    await storage.createFolderPath(localFilePath);

                    // If it's an object, stringify it
                    const content = JSON.stringify(data, null, 4);
                    await storage.writeFile(localFilePath, content);

                    // Verify hash
                    const info = await getFileInfo(content);
                    if (info.hash !== remoteFile.hash) {
                        console.warn(`[Sync] Hash mismatch for downloaded file ${fileBasename}. Remote: ${remoteFile.hash}, Local: ${info.hash}`);
                    }

                    // Update local manifest
                    updatedLocalManifest = await updateManifestEntry(`${LOCAL_SYNC_PATH}/${FILES_MANIFEST}`, remoteFile);
                    downloadCount++;
                }
            }
        }

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 4 finished in ${duration}ms. Downloaded ${downloadCount} files.`);
        return updatedLocalManifest;
    } catch (err) {
        console.error("[Sync] Step 4 error:", err);
        throw err;
    }
}
