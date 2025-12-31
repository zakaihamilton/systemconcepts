import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, FILES_MANIFEST_GZ } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile, writeCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";

/**
 * Step 6: If the local sync has a file that is not in the remote files.json we upload the corresponding .gz file and compress it, upload it to the aws sync folder and add it to the files.json
 */
export async function uploadNewFiles(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 6: Uploading new files...", "info");

    let updatedRemoteManifest = [...remoteManifest];
    let newCount = 0;

    try {
        const remoteMap = new Map(updatedRemoteManifest.map(f => [f.path, f]));

        for (const localFile of localManifest) {
            if (!remoteMap.has(localFile.path)) {

                const fileBasename = localFile.path;
                const localFilePath = makePath(LOCAL_SYNC_PATH, fileBasename);
                const remoteFilePath = makePath(SYNC_BASE_PATH, `${fileBasename}.gz`);

                addSyncLog(`Uploading new file ${fileBasename}...`, "info");

                const content = await storage.readFile(localFilePath);
                if (content) {
                    const data = JSON.parse(content);
                    await writeCompressedFile(remoteFilePath, data);

                    // Verify
                    const redownloaded = await readCompressedFile(remoteFilePath);
                    const redownloadedContent = JSON.stringify(redownloaded, null, 4);
                    const info = await getFileInfo(redownloadedContent);

                    if (info.hash !== localFile.hash) {
                        throw new Error(`Upload verification failed for ${fileBasename}. Hash mismatch.`);
                    }

                    // Update remote manifest (in-memory)
                    updatedRemoteManifest.push(localFile);
                    newCount++;
                }
            }
        }

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 6 finished in ${duration}ms. Uploaded ${newCount} new files.`);
        return updatedRemoteManifest;

    } catch (err) {
        console.error("[Sync] Step 6 error:", err);
        throw err;
    }
}
