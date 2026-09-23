import { SessionsStore } from "@util/domain/sessions";
import { useEffect } from "react";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

export function useSessionReloadOnSyncComplete() {
	const needsSessionReload = SyncActiveStore.useState(
		(s) => s.needsSessionReload,
	);
	const syncBusy = SyncActiveStore.useState((s) => s.busy);
	const updateSessionsBusy = UpdateSessionsStore.useState((s) => s.busy);

	useEffect(() => {
		// Only reload after sync/update-sessions completes (not during)
		if (needsSessionReload && !syncBusy && !updateSessionsBusy) {
			// Trigger a refresh while retaining the current list, so navigating to
			// another view does not briefly render an empty page.
			SessionsStore.update((s) => {
				s.counter++;
			});
			// Clear the flag to acknowledge the reload
			SyncActiveStore.update((s) => {
				s.needsSessionReload = false;
			});
		}
	}, [needsSessionReload, syncBusy, updateSessionsBusy]);
}
