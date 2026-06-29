import { logger as structuredLogger } from "@util/api/logger";
import storage from "@util/storage/storage";

const API_CACHE_STORAGE_PATH = "aws/api-cache";

export async function purgeApiCacheFromStorage() {
	try {
		const exists = await storage.exists(API_CACHE_STORAGE_PATH);
		if (!exists) return 0;
		await storage.deleteFolder(API_CACHE_STORAGE_PATH);
		structuredLogger.debug("[API Cache] Purged api-cache from storage");
		return 1;
	} catch (err) {
		const message = (err?.message || String(err)).toLowerCase();
		if (message.includes("no such key") || message.includes("enoent")) {
			return 0;
		}
		throw err;
	}
}
