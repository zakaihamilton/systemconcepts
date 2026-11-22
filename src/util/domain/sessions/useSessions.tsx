import { registerToolbar, useToolbar } from "@components/Toolbar";
import FilterAltIcon from "@icons/svg/FilterAlt.svg";
import GroupWorkIcon from "@icons/svg/GroupWork.svg";
import { useSync } from "@sync/sync";
import { logger as structuredLogger } from "@util/api/logger";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { GroupsStore, useGroups } from "@util/domain/groups";
import { useTranslations } from "@util/domain/translations";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { filterSessionsList } from "./filterSessions";
import { loadSessionsData } from "./loadSessions";
import { SessionsStore } from "./store";

registerToolbar("Sessions");

export function useSessions(
	depends: unknown[] = [],
	options: Record<string, any> = {},
) {
	const isPhone = useDeviceType() === "phone";
	const { filterSessions = true, skipSync = false, showToolbar } = options;
	const [syncCounter] = useSync({ ...options, active: !skipSync });
	const translations = useTranslations();
	const { settings: groupsSettings } = GroupsStore.useState();
	const [groupMetadata, loading, setGroups] = useGroups([
		syncCounter,
		...depends,
	]);
	const busy = SessionsStore.useState((s) => s.busy);
	const sessions = SessionsStore.useState((s) => s.sessions);
	const groups = SessionsStore.useState((s) => s.groups);
	const groupFilter = SessionsStore.useState((s) => s.groupFilter);
	const typeFilter = SessionsStore.useState((s) => s.typeFilter);
	const yearFilter = SessionsStore.useState((s) => s.yearFilter);
	const savedSyncCounter = SessionsStore.useState((s) => s.syncCounter);
	const groupsHash = SessionsStore.useState((s) => s.groupsHash);
	const showFilterDialog = SessionsStore.useState((s) => s.showFilterDialog);
	const filterBarManuallyEnabled = SessionsStore.useState(
		(s) => s.filterBarManuallyEnabled,
	);
	const counter = SessionsStore.useState((s) => s.counter);
	useLocalStorage("sessions", SessionsStore, [
		"groupFilter",
		"typeFilter",
		"yearFilter",
		"showFilterDialog",
		"filterBarManuallyEnabled",
	]);
	const lastCounterRef = useRef(counter);

	const updateSessions = useCallback(
		async (syncCounter: any) => {
			let continueUpdate = true;
			SessionsStore.update((s) => {
				if (s.busy) {
					continueUpdate = false;
				} else {
					s.busy = true;
				}
			});
			if (!continueUpdate) {
				return;
			}

			try {
				const { sessions: allSessions, groups: loadedGroups } =
					await loadSessionsData({
						groupsSettings,
						groupMetadata,
					});

				SessionsStore.update((s) => {
					s.sessions = allSessions;
					s.groups = loadedGroups;
					s.busy = false;
					s.syncCounter = syncCounter;
					s.groupsHash = JSON.stringify({
						metadata: groupMetadata,
						settings: groupsSettings,
					});
				});
			} catch (err: any) {
				structuredLogger.error(err);
				SessionsStore.update((s) => {
					if (!s.sessions) {
						s.sessions = [];
					}
					s.busy = false;
					s.syncCounter = syncCounter;
				});
			}
		},
		[groupsSettings, groupMetadata],
	);

	useEffect(() => {
		if (groupMetadata && !loading) {
			const currentHash = JSON.stringify({
				metadata: groupMetadata,
				settings: groupsSettings,
			});
			const groupsChanged = currentHash !== groupsHash;
			const noSessions = sessions === null;
			const syncChanged = syncCounter !== savedSyncCounter;
			const counterChanged = counter !== lastCounterRef.current;

			if (counterChanged) {
				lastCounterRef.current = counter;
			}

			if (noSessions || groupsChanged || syncChanged || counterChanged) {
				updateSessions(syncCounter);
			}
		}
	}, [
		groupMetadata,
		loading,
		syncCounter,
		savedSyncCounter,
		groupsHash,
		sessions,
		counter,
		groupsSettings,
		updateSessions,
	]);

	useEffect(() => {
		const hasActiveFilter =
			groupFilter.length > 0 || typeFilter.length > 0 || yearFilter.length > 0;
		if (showFilterDialog && !filterBarManuallyEnabled && !hasActiveFilter) {
			SessionsStore.update((s) => {
				s.showFilterDialog = false;
			});
		}
	}, [
		filterBarManuallyEnabled,
		groupFilter,
		showFilterDialog,
		typeFilter,
		yearFilter,
	]);

	const groupsItems = useMemo(() => {
		return groups.map((group) => {
			const metadata =
				(groupMetadata || []).find((item: any) => item.name === group.name) ||
				{};
			return {
				id: group.name,
				icon:
					!groupFilter.length || groupFilter.includes(group.name) ? (
						<GroupWorkIcon />
					) : null,
				name: group.name[0].toUpperCase() + group.name.slice(1),
				selected: groupFilter,
				backgroundColor: metadata.color,
				onClick: () => {
					SessionsStore.update((s) => {
						if (s.groupFilter.includes(group.name)) {
							s.groupFilter = s.groupFilter.filter(
								(name) => name !== group.name,
							);
						} else {
							s.groupFilter = [...s.groupFilter, group.name];
						}
					});
				},
			};
		});
	}, [groupMetadata, groups, groupFilter]);

	const toolbarItems = [
		{
			id: "filter",
			name: translations.FILTER,
			sortKey: 1,
			icon: <FilterAltIcon />,
			location: isPhone ? "mobile" : "header",
			onClick: () => {
				SessionsStore.update((s) => {
					const showFilterDialog = !s.showFilterDialog;
					s.showFilterDialog = showFilterDialog;
					s.filterBarManuallyEnabled = showFilterDialog;
				});
			},
			active: showFilterDialog,
		},
	].filter(Boolean);

	useToolbar({
		id: "Sessions",
		items: toolbarItems,
		visible: showToolbar !== undefined ? showToolbar : filterSessions,
		depends: [translations, groupsItems, showFilterDialog, isPhone],
	});

	const filtered = useMemo(
		() =>
			filterSessionsList(sessions, {
				groupFilter,
				typeFilter,
				yearFilter,
			}),
		[groupFilter, typeFilter, yearFilter, sessions],
	);

	const items = filterSessions ? filtered : sessions;

	// Only show loading if we don't have sessions yet
	// Don't show loading during sync if we already have data
	const isLoading = (busy || loading) && (!sessions || !sessions.length);
	return [items, isLoading, groupMetadata, setGroups];
}
