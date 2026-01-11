import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, SYNC_BASE_PATH } from "@sync/constants";
import { addSyncLog } from "@sync/sync";

export async function cleanupBundledGroup(name) {
    // Cleanup: Delete individual year files (both local and remote)
    const localYearsPath = makePath(LOCAL_SYNC_PATH, name);
    const remoteYearsPath = makePath(SYNC_BASE_PATH, name);
    try {
        // Delete local year files
        if (await storage.exists(localYearsPath)) {
            console.log(`[Sync] Deleting local split files for bundled group: ${name}`);
            const yearFiles = await storage.getListing(localYearsPath);
            if (yearFiles && yearFiles.length > 0) {
                for (const yearFile of yearFiles) {
                    if (yearFile.name.endsWith('.json')) {
                        const yearFilePath = makePath(localYearsPath, yearFile.name);
                        console.log(`[Sync] Deleting local year file: ${yearFilePath}`);
                        await storage.deleteFile(yearFilePath);
                    }
                }
            }
            // Delete the empty local folder
            await storage.deleteFolder(localYearsPath);
        }

        // Delete remote year files from AWS
        if (await storage.exists(remoteYearsPath)) {
            console.log(`[Sync] Deleting remote split files for bundled group: ${name}`);
            const remoteYearFiles = await storage.getListing(remoteYearsPath);
            if (remoteYearFiles && remoteYearFiles.length > 0) {
                for (const yearFile of remoteYearFiles) {
                    if (yearFile.name.endsWith('.gz')) {
                        const remoteFilePath = makePath(remoteYearsPath, yearFile.name);
                        console.log(`[Sync] Deleting remote year file: ${remoteFilePath}`);
                        await storage.deleteFile(remoteFilePath);
                    }
                }
            }
            // Delete the empty remote folder
            await storage.deleteFolder(remoteYearsPath);
        }
    } catch (err) {
        console.error(`[Sync] Error deleting split files for ${name}:`, err);
        addSyncLog(`[${name}] Warning: Could not delete old split files`, "warning");
    }

    // Update manifests to remove deleted files
    try {
        const localManifestPath = makePath(LOCAL_SYNC_PATH, "files.json");
        if (await storage.exists(localManifestPath)) {
            const content = await storage.readFile(localManifestPath);
            const manifest = JSON.parse(content);
            const yearPathPrefix = `/${name}/`;
            const updatedManifest = manifest.filter(f => !f.path.startsWith(yearPathPrefix));
            if (updatedManifest.length < manifest.length) {
                await storage.writeFile(localManifestPath, JSON.stringify(updatedManifest, null, 4));
                console.log(`[Sync] Removed ${manifest.length - updatedManifest.length} year files from local manifest`);
            }
        }
    } catch (err) {
        console.error(`[Sync] Error updating manifest for ${name}:`, err);
    }

    // Cleanup: Delete merged file if exists (migration)
    const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
    if (await storage.exists(localGroupPath)) {
        await storage.deleteFile(localGroupPath);
    }
    const remoteGroupPath = makePath(SYNC_BASE_PATH, `${name}.json.gz`);
    if (await storage.exists(remoteGroupPath)) {
        await storage.deleteFile(remoteGroupPath);
    }
}

export async function cleanupMergedGroup(name) {
    // Cleanup: Delete individual year files (both local and remote)
    const localYearsPath = makePath(LOCAL_SYNC_PATH, name);
    const remoteYearsPath = makePath(SYNC_BASE_PATH, name);
    try {
        // Delete local year files
        if (await storage.exists(localYearsPath)) {
            console.log(`[Sync] Deleting local split files for merged group: ${name}`);
            const yearFiles = await storage.getListing(localYearsPath);
            if (yearFiles && yearFiles.length > 0) {
                for (const yearFile of yearFiles) {
                    if (yearFile.name.endsWith('.json')) {
                        const yearFilePath = makePath(localYearsPath, yearFile.name);
                        console.log(`[Sync] Deleting local year file: ${yearFilePath}`);
                        await storage.deleteFile(yearFilePath);
                    }
                }
            }
            // Delete the empty local folder
            await storage.deleteFolder(localYearsPath);
            console.log(`[Sync] Successfully deleted local split folder: ${localYearsPath}`);
        }

        // Delete remote year files from AWS
        if (await storage.exists(remoteYearsPath)) {
            console.log(`[Sync] Deleting remote split files for merged group: ${name}`);
            const remoteYearFiles = await storage.getListing(remoteYearsPath);
            if (remoteYearFiles && remoteYearFiles.length > 0) {
                for (const yearFile of remoteYearFiles) {
                    if (yearFile.name.endsWith('.gz')) {
                        const remoteFilePath = makePath(remoteYearsPath, yearFile.name);
                        console.log(`[Sync] Deleting remote year file: ${remoteFilePath}`);
                        await storage.deleteFile(remoteFilePath);
                    }
                }
            }
            // Delete the empty remote folder
            await storage.deleteFolder(remoteYearsPath);
            console.log(`[Sync] Successfully deleted remote split folder: ${remoteYearsPath}`);
        }
    } catch (err) {
        console.error(`[Sync] Error deleting split files for ${name}:`, err);
        addSyncLog(`[${name}] Warning: Could not delete old split files`, "warning");
    }
}
