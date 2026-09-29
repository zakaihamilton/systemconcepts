import ViewTransition from "@components/ViewTransition";
import { SyncActiveStore } from "@sync/syncState";
import { useSessionReloadOnSyncComplete } from "@sync/useSessionReloadOnSyncComplete";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useDateFormatter } from "@util/data/locale";
import { useRecentHistory } from "@util/domain/history";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useRequireSigninMode } from "@util/domain/useRequireSigninMode";
import { addPath, toPath } from "@util/domain/views";
import { PlayerStore } from "@views/Player/Player";
import FilterBar from "@views/Sessions/FilterBar";
import StatusBar from "@widgets/StatusBar";
import Table from "@widgets/Table";
import Cookies from "js-cookie";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTreePrefixMap } from "./buildTreePrefixMap";
import { renderSessionColumn } from "./renderSessionColumn";
import styles from "./Sessions.module.css";
import {
	collectSessionIds,
	getSessionDateLocale,
	hasNewSessionId,
} from "./sessionHelpers";
import { useSessionTreeGrouping } from "./useSessionTreeGrouping";

export default function SessionsPage() {
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	const isMobile = useDeviceType() === "phone";
	const translations = useTranslations();
	const sessionDateLocale = useMemo(() => getSessionDateLocale(), []);
	const shortDateFormatter = useDateFormatter(
		{
			year: "2-digit",
			month: "2-digit",
			day: "2-digit",
		},
		sessionDateLocale,
	);
	const monthFormatter = useDateFormatter(
		{ month: "short" },
		sessionDateLocale,
	);

	const formatDate = useCallback(
		(dateStr: any) => {
			if (!dateStr) return "";
			const parts = dateStr.split("-");
			if (parts.length === 3) {
				const year = parseInt(parts[0], 10);
				const month = parseInt(parts[1], 10) - 1;
				const day = parseInt(parts[2], 10);
				const d = new Date(year, month, day);
				if (!isNaN(d.getTime())) {
					if (isMobile) {
						return shortDateFormatter.formatToParts(d).map((part, index) =>
							part.type === "day" ? (
								<strong
									key={`${part.type}-${index}`}
									className={styles.dateDay}
								>
									{part.value}
								</strong>
							) : (
								<span key={`${part.type}-${index}`}>{part.value}</span>
							),
						);
					}
					return (
						<>
							<strong className={styles.dateDay}>{day}</strong>{" "}
							{monthFormatter.format(d)} {year}
						</>
					);
				}
			}
			return dateStr;
		},
		[isMobile, monthFormatter, shortDateFormatter],
	);

	const [sessions, loading] = useSessions();
	const viewMode = SessionsStore.useState((s) => s.viewMode);
	const groupFilter = SessionsStore.useState((s) => s.groupFilter);
	const typeFilter = SessionsStore.useState((s) => s.typeFilter);
	const yearFilter = SessionsStore.useState((s) => s.yearFilter);
	const orderBy = SessionsStore.useState((s) => s.orderBy);
	const order = SessionsStore.useState((s) => s.order);
	const showHistory = SessionsStore.useState((s) => s.showHistory);
	const expandedTreeGroups =
		SessionsStore.useState((s) => s.expandedTreeGroups) || [];
	const { session } = PlayerStore.useState();
	const [history] = useRecentHistory();
	const prevSessionIdsRef = useRef<any>(null);
	const [newSessionsScrollKey, setNewSessionsScrollKey] = useState(0);
	useLocalStorage("SessionsStore", SessionsStore, [
		"viewMode",
		"scrollOffset",
		"showHistory",
	]);

	useEffect(() => {
		if (loading || !sessions) {
			return;
		}
		const nextIds = collectSessionIds(sessions);
		const previousIds = prevSessionIdsRef.current;
		prevSessionIdsRef.current = nextIds;
		if (!previousIds || !hasNewSessionId(previousIds, nextIds)) {
			return;
		}
		setNewSessionsScrollKey((key) => key + 1);
		SessionsStore.update((s) => {
			s.offset = 0;
		});
	}, [sessions, loading]);

	// Memoize dependencies to prevent unnecessary resets
	const resetScrollDeps = useMemo(
		() => [
			groupFilter,
			typeFilter,
			yearFilter,
			orderBy,
			order,
			viewMode,
			showHistory,
			history,
			newSessionsScrollKey,
		],
		[
			groupFilter,
			typeFilter,
			yearFilter,
			orderBy,
			order,
			viewMode,
			showHistory,
			history,
			newSessionsScrollKey,
		],
	);
	const tableDeps = useMemo(
		() => [
			groupFilter,
			typeFilter,
			yearFilter,
			translations,
			viewMode,
			session,
			showHistory,
			history,
		],
		[
			groupFilter,
			typeFilter,
			yearFilter,
			translations,
			viewMode,
			session,
			showHistory,
			history,
		],
	);
	const itemPath = (item: any) => {
		return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
	};

	const target = useCallback((item: any) => {
		return "#" + toPath("sessions", itemPath(item));
	}, []);

	const gotoItem = useCallback((item: any) => {
		addPath(itemPath(item));
	}, []);

	const columns = useMemo(
		() =>
			[
				{
					id: "thumbnailWidget",
					title: translations.THUMBNAIL,
					viewModes: {
						grid: {
							className: styles.gridThumbnail,
						},
					},
				},
				{
					id: "nameWidget",
					title: translations.NAME,
					sortable: "name",
					padding: false,
					viewModes: {
						tree: {
							className: styles.compactNameCell,
						},
						list: {
							className: styles.compactNameCell,
						},
						table: null,
						grid: {
							className: styles.gridName,
						},
					},
				},
				{
					id: "date",
					title: translations.DATE,
					sortable: true,
					style: {
						justifyContent: "center",
					},
					columnProps: {
						style: {
							width: isMobile ? "7em" : "12em",
						},
					},
					viewModes: {
						...((!isMobile || orderBy !== "duration") && {
							tree: {
								className: styles.compactDateCell,
							},
							list: {
								className: styles.compactDateCell,
							},
							table: null,
						}),
						grid: {
							className: styles.gridDate,
						},
					},
				},
				{
					id: "type",
					title: translations.TYPE,
					sortable: "typeOrder",
					viewModes: {},
				},
				{
					id: "durationWidget",
					title: translations.DURATION,
					sortable: "duration",
					style: {
						justifyContent: "center",
					},
					columnProps: {
						style: {
							width: "8em",
						},
					},
					viewModes: {
						...((!isMobile || orderBy === "duration") && {
							tree: null,
							list: null,
							table: null,
						}),
						grid: {
							className: styles.gridDuration,
						},
					},
				},
				{
					id: "groupWidget",
					title: translations.GROUP,
					sortable: "group",
					onSelectable: (item: any) => typeof item.group !== "undefined",
					onClick: (item: any) =>
						SessionsStore.update((s) => {
							const group = typeof item.group !== "undefined" && item.group;
							if (s.groupFilter.includes(group)) {
								s.groupFilter = s.groupFilter.filter((g) => g !== group);
							} else {
								s.groupFilter = [...s.groupFilter, group];
							}
							s.showFilterDialog = true;
							s.offset = 0;
						}),
					columnProps: {
						style: {
							width: "8em",
						},
					},
					style: {
						justifyContent: "center",
					},
					viewModes: {
						tree: {
							className: styles.compactGroupCell,
						},
						list: {
							className: styles.compactGroupCell,
						},
						table: null,
						grid: {
							className: styles.gridGroup,
							selectedClassName: styles.gridGroupSelected,
						},
					},
				},
				{
					id: "tagsWidget",
					title: translations.TAGS,
					searchable: "tagsString",
					sortable: false,
					visible: false,
				},
			].filter(Boolean),
		[translations, isMobile, orderBy],
	);

	const handleIconClick = useCallback((itemType: any) => {
		SessionsStore.update((s) => {
			if (s.typeFilter.includes(itemType)) {
				s.typeFilter = s.typeFilter.filter((t) => t !== itemType);
			} else {
				s.typeFilter = [...s.typeFilter, itemType];
			}
			s.showFilterDialog = true;
			s.offset = 0;
		});
	}, []);

	const treePrefixMap = useMemo(() => buildTreePrefixMap(sessions), [sessions]);

	const mapper = useCallback(
		(item: any) => {
			if (!item) {
				return null;
			}

			const percentage = item.duration && (item.position / item.duration) * 100;
			const isPlaying =
				session &&
				session.group === item.group &&
				session.date === item.date &&
				session.name === item.name;

			const lookupKey = `${item.group}||${item.date}||${item.name}`;
			let treePrefix = treePrefixMap.get(lookupKey);

			if (!treePrefix && item.name) {
				const HYPHENS = /[-\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u;
				const parts = item.name.split(HYPHENS);
				if (parts.length > 1) {
					treePrefix = parts[0].trim();
				}
			}

			if (item.type === "overview") {
				treePrefix = `_overview_${item.id}`;
			}
			const treeGroupKey = `${item.group}||${item.date}||${treePrefix}`;

			return {
				// Identity & core data
				key: item.key,
				id: item.id,
				name: item.name,
				date: item.date,
				year: item.year,
				group: item.group,
				color: item.color,
				type: item.type,
				typeOrder: item.typeOrder,

				// Media properties
				thumbnail: item.thumbnail,
				video: item.video,
				ai: item.ai,
				duration: item.duration,
				position: item.position,
				percentage,

				// Pre-computed display values
				summary: item.summary,
				tags: item.tags || [],
				tagsString: item.tagsString,
				formattedDuration:
					item.type === "image" ? "" : item.durationStr || translations.UNKNOWN,
				treePrefix,
				treeGroupKey,
				isPlaying,
			};
		},
		[translations, session, treePrefixMap],
	);

	const renderColumn = useCallback(
		(columnId: any, item: any) =>
			renderSessionColumn(columnId, item, {
				viewMode,
				target,
				gotoItem,
				handleIconClick,
				formatDate,
			}),
		[viewMode, target, gotoItem, handleIconClick, formatDate],
	);

	const treeGroup = useSessionTreeGrouping();

	const getSeparator = useCallback((item: any, prevItem: any, orderBy: any) => {
		if (orderBy === "date") {
			return item.date !== prevItem.date;
		}
		if (orderBy === "group") {
			return item.group !== prevItem.group;
		}
		if (orderBy === "typeOrder") {
			return item.type !== prevItem.type;
		}
		return false;
	}, []);

	const viewModes = useMemo(
		() => ({
			tree: {
				className: isMobile ? styles.treePhoneItem : styles.treeItem,
			},
			list: {
				className: isMobile ? styles.listPhoneItem : styles.listItem,
			},
			table: null,
			grid: {
				className: styles.gridItem,
			},
		}),
		[isMobile],
	);

	const statusBar = useMemo(() => <StatusBar store={SessionsStore} />, []);
	const syncBusy = SyncActiveStore.useState((s) => s.busy);

	useRequireSigninMode(SessionsStore, isSignedIn, translations);
	useSessionReloadOnSyncComplete();

	return (
		<>
			{!isMobile && <FilterBar />}
			<ViewTransition transitionKey={viewMode}>
				<Table
					cellWidth={isMobile ? "11em" : "16em"}
					cellHeight={isMobile ? "11.5em" : "15.8em"}
					className={styles.sessionsTable}
					name={translations.SESSIONS}
					store={SessionsStore}
					data={sessions}
					loading={loading}
					depends={tableDeps}
					hover
					columns={columns}
					mapper={mapper}
					viewModes={viewModes}
					statusBar={statusBar}
					treeGroup={treeGroup}
					expandedTreeGroups={expandedTreeGroups}
					resetScrollDeps={resetScrollDeps}
					getSeparator={getSeparator}
					renderColumn={renderColumn}
					rowClassName={(item: any) => {
						const classes = [];
						if (item.isPlaying) classes.push(styles.playing);
						if (item.isExpanded || item.isTreeChild)
							classes.push(styles.expandedGroupHighlight);
						if (item.isTreeChild) classes.push(styles.treeChild);
						return classes.join(" ");
					}}
					emptyLabel={
						syncBusy ? translations.SYNCING + "..." : translations.NO_ITEMS
					}
				/>
			</ViewTransition>

			{!!isMobile && <FilterBar />}
		</>
	);
}
