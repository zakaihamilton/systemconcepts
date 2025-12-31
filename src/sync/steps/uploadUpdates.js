import storage from "@util/storage";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, FILES_MANIFEST_GZ } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile, writeCompressedFile } from "../bundle";
import { getFileInfo } from "../fileUtils";
import { updateManifestEntry } from "../manifestUtils";

/**
 * Step 5: If the version is lower on the remote file we upload the corresponding .gz file and compress it and replace the remote file
 */
export async function uploadUpdates(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 5: Uploading updates...", "info");

    let updatedRemoteManifest = [...remoteManifest];
    let uploadCount = 0;

    try {
        const remoteMap = new Map(remoteManifest.map(f => [f.path, f]));

        for (const localFile of localManifest) {
            const remoteFile = remoteMap.get(localFile.path);

            const localVer = parseInt(localFile.version);
            const remoteVer = remoteFile ? parseInt(remoteFile.version) : 0;

            if (remoteFile && localVer > remoteVer) {
                const fileBasename = localFile.path;
                const localFilePath = `${LOCAL_SYNC_PATH}/${fileBasename}`;
                const remoteFilePath = `${SYNC_BASE_PATH}/${fileBasename}.gz`;

                addSyncLog(`Uploading ${fileBasename} (v${localVer})...`, "info");

                const content = await storage.readFile(localFilePath);
                if (content) {
                    const data = JSON.parse(content);
                    await writeCompressedFile(remoteFilePath, data);

                    // Verify uploads
                    const redownloaded = await readCompressedFile(remoteFilePath);
                    const redownloadedContent = JSON.stringify(redownloaded, null, 4);
                    const info = await getFileInfo(redownloadedContent);

                    if (info.hash !== localFile.hash) {
                        throw new Error(`Upload verification failed for ${fileBasename}. Hash mismatch.`);
                    }

                    // Update remote manifest
                    updatedRemoteManifest = await updateManifestEntry(`${SYNC_BASE_PATH}/${FILES_MANIFEST_GZ}`, localFile);
                    uploadCount++;
                }
            }
        }

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 5 finished in ${duration}ms. Uploaded ${uploadCount} files.`);
        return updatedRemoteManifest;

    } catch (err) {
        console.error("[Sync] Step 5 error:", err);
        throw err;
    }
}
