import { SyncActiveStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";

export function addSyncLog(message, type = "info") {
	// Check global debug level from store
	const currentDebugLevel = SyncActiveStore.getRawState().debugLevel || "info";

	// If type is verbose and we are not in verbose mode, skip logging to UI (console only)
	if (type === "verbose" && currentDebugLevel !== "verbose") {
		structuredLogger.debug(`[Sync-Verbose] ${message}`);
		return;
	}

	// Also log to console for debugging
	const logMethod =
		type === "error"
			? structuredLogger.error
			: type === "warning"
				? structuredLogger.warn
				: structuredLogger.debug;
	logMethod(`[Sync] ${message}`);

	SyncActiveStore.update((s) => {
		s.logs = [
			...(s.logs || []),
			{
				id: Date.now() + Math.random(),
				timestamp: Date.now(),
				message,
				type,
			},
		].slice(-300); // Keep last 300 logs
	});
}
