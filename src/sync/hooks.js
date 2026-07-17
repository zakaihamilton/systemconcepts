import { usePageVisibility } from "@util/browser/hooks";
import { useOnline } from "@util/browser/online";
import Cookies from "js-cookie";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	AUTO_SYNC_INTERVAL_MS,
	getAutoSyncJitter,
	shouldRunInitialAutoSync,
} from "./autoSync";
import { requestSync, stopSync } from "./requests";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

export function useSyncFeature() {
	const state = SyncActiveStore.useState((current) => ({
		busy: current.busy,
		lastSynced: current.lastSynced,
		logs: current.logs,
		lastDuration: current.lastDuration,
		startTime: current.startTime,
		progress: current.progress,
		personalSyncBusy: current.personalSyncBusy,
		personalSyncError: current.personalSyncError,
		phase: current.phase,
	}));
	const percentage =
		state.progress && state.progress.total > 0
			? Math.round((state.progress.processed / state.progress.total) * 100)
			: 0;
	const isSyncing = state.busy || state.personalSyncBusy;
	return {
		sync: () => requestSync(true),
		stop: stopSync,
		busy: state.busy,
		lastSynced: state.lastSynced,
		duration: state.lastDuration,
		logs: state.logs,
		percentage: isSyncing && percentage >= 100 ? 99 : percentage,
		startTime: state.startTime,
		personalSyncBusy: state.personalSyncBusy,
		personalSyncError: state.personalSyncError,
		phase: state.phase,
	};
}

export function useSync(options = {}) {
	const { active = true, schedule = false } = options;
	const online = useOnline();
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	const isVisible = usePageVisibility();
	const { busy, autoSync } = SyncActiveStore.useState((state) => ({
		busy: state.busy,
		autoSync: state.autoSync,
	}));
	const [counter, setCounter] = useState(0);
	const timerRef = useRef(null);

	const checkSync = useCallback(() => {
		if (!active || !online || !isSignedIn || !isVisible || !autoSync) return;
		const sessionsBusy = UpdateSessionsStore.getRawState().busy;
		const elapsed = Date.now() - SyncActiveStore.getRawState().lastSyncTime;
		const isDue =
			shouldRunInitialAutoSync() ||
			elapsed >= AUTO_SYNC_INTERVAL_MS + getAutoSyncJitter();
		if (isDue && !busy && !sessionsBusy) {
			requestSync(false);
		}
	}, [active, online, isSignedIn, isVisible, autoSync, busy]);

	useEffect(() => {
		if (!schedule) return;
		// Run immediately on load and when the page becomes visible again. The
		// due check keeps this from creating extra syncs for recent activity.
		checkSync();
		timerRef.current = setInterval(
			checkSync,
			Math.max(60 * 1000, AUTO_SYNC_INTERVAL_MS / 2),
		);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [schedule, checkSync]);

	useEffect(
		() =>
			SyncActiveStore.subscribe(
				(state) => state.counter,
				(nextCounter) => setCounter(nextCounter),
			),
		[],
	);
	return [counter, busy];
}
