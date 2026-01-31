import { makePath } from "@util/path";
import { FILES_MANIFEST_GZ, SYNC_BASE_PATH } from "../constants";
import { addSyncLog } from "../logs";
import { writeCompressedFile } from "../bundle";
import Cookies from "js-cookie";

/**
 * Normalize a file path to ensure it starts with a leading slash
 */
function normalizePath(path) {
    if (!path) return path;
    return path.startsWith("/") ? path : "/" + path;
}

/**
 * Normalize and deduplicate manifest entries before upload
 * Ensures all paths have leading slashes and removes duplicates (keeping highest version)
 */
function normalizeManifest(manifest) {
    if (!manifest || !Array.isArray(manifest)) return [];

    const pathMap = new Map();

    for (const entry of manifest) {
        const normalizedPath = normalizePath(entry.path);
        const normalizedEntry = { ...entry, path: normalizedPath };
        const version = parseInt(entry.version) || 0;

        if (pathMap.has(normalizedPath)) {
            // Keep the entry with higher version
            const existing = pathMap.get(normalizedPath);
            const existingVersion = parseInt(existing.version) || 0;
            if (version > existingVersion) {
                pathMap.set(normalizedPath, normalizedEntry);
            }
        } else {
            pathMap.set(normalizedPath, normalizedEntry);
        }
    }

    return Array.from(pathMap.values());
}

/**
 * Step 7: Upload the final manifest file
 */
export async function uploadManifest(remoteManifest, remotePath = SYNC_BASE_PATH) {
    const start = performance.now();
    addSyncLog("Step 7: Uploading manifest...", "info");

    // Role check is handled by caller (sync.js)

    const normalizedManifest = normalizeManifest(remoteManifest);
    const deduped = (remoteManifest?.length || 0) - normalizedManifest.length;
    if (deduped > 0) {
        console.log(`[Sync] Removed ${deduped} duplicate entries from manifest before upload`);
    }

    // Prevent uploading empty manifest to avoid corruption
    const fileCount = normalizedManifest.length;
    if (fileCount === 0) {
        addSyncLog("Skipping manifest upload (empty manifest would corrupt sync)", "warning");
        return;
    }

    try {
        const remoteManifestPath = makePath(remotePath, FILES_MANIFEST_GZ);
        await writeCompressedFile(remoteManifestPath, normalizedManifest);

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
