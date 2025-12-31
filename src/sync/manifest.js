import storage from "@util/storage";
import { readCompressedFile, writeCompressedFile } from "./bundle";

/**
 * Helper to update manifest after file transfer
 */
export async function updateManifestEntry(manifestPath, entry) {
    let manifest = [];
    if (await storage.exists(manifestPath)) {
        if (manifestPath.endsWith(".gz")) {
            manifest = await readCompressedFile(manifestPath) || [];
        } else {
            const content = await storage.readFile(manifestPath);
            manifest = JSON.parse(content);
        }
    }

    // Check if entry exists
    const index = manifest.findIndex(f => f.path === entry.path);
    if (index !== -1) {
        manifest[index] = entry;
    } else {
        manifest.push(entry);
    }

    if (manifestPath.endsWith(".gz")) {
        await writeCompressedFile(manifestPath, manifest);
    } else {
        await storage.writeFile(manifestPath, JSON.stringify(manifest, null, 4));
    }
    return manifest;
}

/**
 * Apply multiple manifest updates in a single write operation
 * More efficient than calling updateManifestEntry multiple times
 */
export async function applyManifestUpdates(baseManifest, updates) {
    if (!updates || updates.length === 0) return baseManifest;

    const manifest = [...baseManifest];
    const pathMap = new Map(manifest.map((f, i) => [f.path, i]));

    for (const update of updates) {
        const index = pathMap.get(update.path);
        if (index !== undefined) {
            manifest[index] = update;
        } else {
            manifest.push(update);
            pathMap.set(update.path, manifest.length - 1);
        }
    }

    return manifest;
}
