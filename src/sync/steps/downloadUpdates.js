import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BATCH_SIZE, FILES_MANIFEST, FILES_MANIFEST_GZ, LOCAL_SYNC_PATH, SYNC_BASE_PATH } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFileRaw, writeCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { applyManifestUpdates } from "../manifest";
import { lockMutex } from "../mutex";
import { SyncActiveStore } from "../syncState";

/**
 * Helper function to download a single file
 */
async function downloadFile(remoteFile, localEntry, createdFolders, localPath, remotePath) {
    const fileBasename = remoteFile.path;
    const localFilePath = makePath(localPath, fileBasename);
    let remoteFilePath = makePath(remotePath, `${fileBasename}.gz`);

    try {
        let content = await readCompressedFileRaw(remoteFilePath);

        if (content === null) {
            // Try without .gz extension
            remoteFilePath = makePath(remotePath, fileBasename);
            content = await readCompressedFileRaw(remoteFilePath);
        }

        if (content === null) return null;

        if (createdFolders) {
            const folder = localFilePath.substring(0, localFilePath.lastIndexOf("/"));
            if (!createdFolders.has(folder)) {
                await storage.createFolderPath(localFilePath);
                createdFolders.add(folder);
            }
        } else {
            await storage.createFolderPath(localFilePath);
        }

        // --- HASH VERIFICATION & PRETTY PRINTING ---
        let contentToWrite = content;
        let finalHash = null;
        let finalSize = 0;

        // 1. Calculate hash of RAW content
        const rawInfo = await getFileInfo(content);
        finalHash = rawInfo.hash;
        finalSize = rawInfo.size;

        // 2. Try to pretty-print if small json
        let prettyContent = null;
        let prettyInfo = null;

        if (content.length < 500 * 1024) { // 500KB
            try {
                const obj = JSON.parse(content);
                prettyContent = JSON.stringify(obj, null, 4);
                prettyInfo = await getFileInfo(prettyContent);
            } catch {
                // Ignore parse errors
            }
        }

        // 3. Decide which content to write
        // If we have a remote hash, we MUST match it to avoid conflicts
        if (remoteFile.hash) {
            if (rawInfo.hash === remoteFile.hash) {
                // Raw matches! Use raw to stay in sync.
                addSyncLog(`${fileBasename}: Matches RAW remote hash (${remoteFile.hash}). Writing raw.`, "verbose");
                contentToWrite = content;
                finalHash = rawInfo.hash;
                finalSize = rawInfo.size;
            } else if (prettyInfo && prettyInfo.hash === remoteFile.hash) {
                // Pretty matches! Use pretty.
                addSyncLog(`${fileBasename}: Matches PRETTY remote hash (${remoteFile.hash}). Writing pretty-printed.`, "verbose");
                contentToWrite = prettyContent;
                finalHash = prettyInfo.hash;
                finalSize = prettyInfo.size;
            } else {
                // Neither matches (rare corruption or different hashing?)
                // Default to pretty if available for readability, otherwise raw
                console.warn(`[Sync] Hash mismatch for ${fileBasename}. Remote: ${remoteFile.hash}, Raw: ${rawInfo.hash}, Pretty: ${prettyInfo?.hash}`);
                if (prettyInfo) {
                    contentToWrite = prettyContent;
                    finalHash = prettyInfo.hash;
                    finalSize = prettyInfo.size;
                }
            }
        } else {
            // No remote hash? Default to pretty for readability
            if (prettyInfo) {
                addSyncLog(`${fileBasename}: No remote hash. Defaulting to pretty-printed.`, "verbose");
                contentToWrite = prettyContent;
                finalHash = prettyInfo.hash;
                finalSize = prettyInfo.size;
            }
        }

        const unlock = await lockMutex({ id: localFilePath });
        try {
            // Check if file has changed locally since sync started
            // This prevents overwriting newer local changes with older remote files
            if (await storage.exists(localFilePath)) {
                const currentContent = await storage.readFile(localFilePath);
                if (currentContent) {
                    const info = await getFileInfo(currentContent);

                    // Only treat as conflict if file is in manifest AND hash differs
                    // If file is not in manifest, just download it normally
                    if (localEntry && info.hash !== localEntry.hash) {
                        console.warn(`[Sync] Conflict detected for ${fileBasename}:`);
                        console.warn(`  - File exists locally and in manifest`);
                        console.warn(`  - Hash mismatch: manifest=${localEntry.hash}, current=${info.hash}`);

                        const remoteVer = parseInt(remoteFile.version) || 0;
                        const localVer = parseInt(localEntry.version) || 0;
                        const newVer = Math.max(remoteVer, localVer) + 1;

                        addSyncLog(`Conflict resolved: ${fileBasename} (local version bumped to ${newVer})`, "warning");

                        return {
                            path: remoteFile.path,
                            hash: info.hash,
                            size: info.size,
                            version: newVer.toString()
                        };
                    }
                }
            }

            try {
                await storage.writeFile(localFilePath, contentToWrite);
            } catch (err) {
                const errorStr = (err.message || String(err)).toLowerCase();
                if (errorStr.includes("eisdir")) {
                    console.warn(`[Sync] Path ${localFilePath} is a directory, removing to write file.`);
                    await storage.deleteFolder(localFilePath);
                    await storage.writeFile(localFilePath, contentToWrite);
                } else {
                    throw err;
                }
            }
        } finally {
            unlock();
        }

        addSyncLog(`Downloaded: ${makePath(remotePath, fileBasename)}`, "info");

        // Return the actual properties of what we wrote
        // This ensures the local manifest is accurate to what is on disk
        return {
            ...remoteFile,
            hash: finalHash,
            size: finalSize
        };
    } catch (err) {
        console.error(`[Sync] Failed to download ${fileBasename}:`, err);
        addSyncLog(`Failed to download: ${fileBasename}`, "error");
        return null;
    }
}

/**
 * Step 4: Download files that have higher version on remote
 * Uses parallel batch processing for performance
 */
export async function downloadUpdates(localManifest, remoteManifest, localPath = LOCAL_SYNC_PATH, remotePath = SYNC_BASE_PATH, canUpload = true, progressTracker = null) {
    const start = performance.now();
    addSyncLog("Step 4: Downloading updates...", "info");

    try {
        const localMap = new Map((localManifest || []).map(f => [f.path, f]));
        const toDownload = [];
        const createdFolders = new Set();
        const missingOnRemote = [];

        // Collect files that need downloading
        for (const remoteFile of remoteManifest) {
            const localFile = localMap.get(remoteFile.path);
            const remoteVer = parseInt(remoteFile.version) || 0;
            const localVer = localFile ? (parseInt(localFile.version) || 0) : 0;

            console.log(`[Sync] Check ${remoteFile.path}: remoteVer=${remoteVer}, localVer=${localVer}`);

            if (remoteVer > localVer || !localFile) {
                toDownload.push(remoteFile);
            }
            else if (localFile.deleted) {
                if (canUpload) {
                    // Admin: Keep it deleted locally, skip download
                    console.log(`[Sync] Skipping download for locally deleted file: ${remoteFile.path}`);
                } else {
                    // Student/Visitor: Re-download to restore from remote
                    console.log(`[Sync] Restoring locally deleted file from remote: ${remoteFile.path}`);
                    toDownload.push(remoteFile);
                }
            }
        }

        if (toDownload.length === 0) {
            console.log("[Sync] Comparison complete, nothing to download. Remote Manifest:", JSON.stringify(remoteManifest));
            return { manifest: localManifest, hasChanges: false, cleanedRemoteManifest: remoteManifest };
        }

        addSyncLog(`Downloading ${toDownload.length} file(s)...`, "info");

        if (progressTracker) {
            progressTracker.updateProgress('downloadUpdates', { processed: 0, total: toDownload.length });
        }

        // Download in parallel batches
        const updates = [];
        for (let i = 0; i < toDownload.length; i += SYNC_BATCH_SIZE) {
            // Check for cancellation
            if (SyncActiveStore.getRawState().stopping) {
                addSyncLog("Download stopped by user", "warning");
                break;
            }
            const batch = toDownload.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, toDownload.length);
            const percent = Math.round((progress / toDownload.length) * 100);

            addSyncLog(`Downloading ${progress}/${toDownload.length} (${percent}%)...`, "info");

            if (progressTracker) {
                progressTracker.updateProgress('downloadUpdates', { processed: progress, total: toDownload.length });
            }

            const results = await Promise.all(
                batch.map(async remoteFile => {
                    const localEntry = localMap.get(remoteFile.path);
                    const result = await downloadFile(remoteFile, localEntry, createdFolders, localPath, remotePath);
                    // If download returned null, the file doesn't exist on remote (or read failed)
                    if (result === null) {
                        missingOnRemote.push(remoteFile);
                    }
                    return result;
                })
            );

            updates.push(...results.filter(Boolean));
        }

        // Clean remote manifest if we found missing files
        let cleanedRemoteManifest = remoteManifest;
        if (missingOnRemote.length > 0 && !SyncActiveStore.getRawState().stopping) {
            addSyncLog(`Found ${missingOnRemote.length} missing file(s) on remote, cleaning manifest...`, "info");

            const missingPaths = new Set(missingOnRemote.map(f => f.path));
            cleanedRemoteManifest = remoteManifest.filter(f => !missingPaths.has(f.path));

            // Log each missing file
            missingOnRemote.forEach(file => {
                addSyncLog(`Removed from remote manifest: ${file.path} (file not found)`, "info");
            });

            // Upload the cleaned manifest only if uploads are allowed
            if (canUpload) {
                const manifestPath = makePath(remotePath, FILES_MANIFEST_GZ);
                await writeCompressedFile(manifestPath, cleanedRemoteManifest);
                addSyncLog(`✓ Cleaned remote manifest (removed ${missingOnRemote.length} missing files)`, "success");
            } else {
                addSyncLog(`Manifest cleaning skipped (${missingOnRemote.length} missing files) - Sync is Locked`, "warning");
            }
        }

        // Apply all updates in a single operation
        const updatedManifest = await applyManifestUpdates(localManifest, updates);

        // Write updated manifest to disk
        const manifestPath = makePath(localPath, FILES_MANIFEST);
        const unlock = await lockMutex({ id: manifestPath });
        try {
            await storage.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 4));
        } finally {
            unlock();
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Downloaded ${updates.length} file(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0, cleanedRemoteManifest };

    } catch (err) {
        console.error("[Sync] Download failed:", err);
        addSyncLog(`Download failed: ${err.message}`, "error");
        throw err;
    }
}
