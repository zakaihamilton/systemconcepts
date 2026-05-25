import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import MovieIcon from "@mui/icons-material/Movie";
import Chip from "@mui/material/Chip";
import { SyncActiveStore } from "@sync/syncState";
import { useRecentHistory } from "@util/domain/history";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { useDateFormatter } from "@util/data/locale";
import { addPath, toPath } from "@util/domain/views";
import { PlayerStore } from "@views/Player/Player";
import FilterBar from "@views/Sessions/FilterBar";
import Group from "@widgets/Group";
import Image from "@widgets/Image";
import Label from "@widgets/Label";
import Row from "@widgets/Row";
import SessionIcon from "@widgets/SessionIcon";
import StatusBar from "@widgets/StatusBar";
import Table from "@widgets/Table";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import Cookies from "js-cookie";
import { useCallback, useEffect, useMemo, useRef } from "react";
import styles from "./Sessions.module.css";

function getSessionDateLocale() {
	if (typeof navigator === "undefined") {
		return undefined;
	}
	return navigator.languages?.[0] || navigator.language;
}

export default function SessionsPage() {
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	const isMobile = useDeviceType() === "phone";
	const translations = useTranslations();
	const sessionDateLocale = useMemo(() => getSessionDateLocale(), []);
	const shortDateFormatter = useDateFormatter({
		year: "2-digit",
		month: "2-digit",
		day: "2-digit",
	}, sessionDateLocale);
	const monthFormatter = useDateFormatter({ month: "short" }, sessionDateLocale);

	const formatDate = useCallback((dateStr) => {
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
							<strong key={`${part.type}-${index}`} className={styles.dateDay}>
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
	}, [isMobile, monthFormatter, shortDateFormatter]);

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
	useLocalStorage("SessionsStore", SessionsStore, [
		"viewMode",
		"scrollOffset",
		"showHistory",
	]);

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
	const itemPath = (item) => {
		return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
	};

	const target = useCallback((item) => {
		return "#" + toPath("sessions", itemPath(item));
	}, []);

	const gotoItem = useCallback((item) => {
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
					onSelectable: (item) => typeof item.group !== "undefined",
					onClick: (item) =>
						SessionsStore.update((s) => {
							const group = typeof item.group !== "undefined" && item.group;
							if (s.groupFilter.includes(group)) {
								s.groupFilter = s.groupFilter.filter((g) => g !== group);
							} else {
								s.groupFilter = [...s.groupFilter, group];
							}
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

	const handleIconClick = useCallback((itemType) => {
		SessionsStore.update((s) => {
			if (s.typeFilter.includes(itemType)) {
				s.typeFilter = s.typeFilter.filter((t) => t !== itemType);
			} else {
				s.typeFilter = [...s.typeFilter, itemType];
			}
			s.offset = 0;
		});
	}, []);

	const treePrefixMap = useMemo(() => {
		if (!sessions) return new Map();

		const buckets = {};
		for (const s of sessions) {
			if (!s.name) continue;
			const bucketKey = `${s.group}||${s.date}`;
			if (!buckets[bucketKey]) buckets[bucketKey] = [];
			buckets[bucketKey].push(s.name);
		}

		const prefixMap = new Map();
		const HYPHENS = /[-\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u;
		const isBoundary = (c) => !c || /[^\p{L}\p{N}]/u.test(c);

		for (const bucketKey in buckets) {
			const names = buckets[bucketKey];

			// 1. Generate all possible prefixes
			const allPrefixes = new Set();
			for (const name of names) {
				allPrefixes.add(name);
				for (let i = 0; i < name.length; i++) {
					if (HYPHENS.test(name[i])) {
						const extracted = name.substring(0, i);
						const clean = extracted.replace(/[^\p{L}\p{N}]+$/u, "");
						if (clean.length > 2) {
							allPrefixes.add(clean);
						}
					}
				}
			}

			const validPrefixes = Array.from(allPrefixes).sort(
				(a, b) => b.length - a.length,
			);

			// 2. Pre-calculate counts for prefixes that appear more than once
			const prefixCounts = new Map();
			for (const p of validPrefixes) {
				let count = 0;
				for (const name of names) {
					if (name.toLowerCase().startsWith(p.toLowerCase())) {
						const nextChar = name[p.length];
						if (
							isBoundary(nextChar) ||
							p.toLowerCase() === name.toLowerCase()
						) {
							count++;
						}
					}
				}
				if (count > 1) {
					prefixCounts.set(p, count);
				}
			}

			// 3. Find the final prefix for each name using the pre-calculated counts
			for (const name of names) {
				let finalPrefix = name;
				const nameLower = name.toLowerCase();

				for (const p of validPrefixes) {
					if (nameLower.startsWith(p.toLowerCase())) {
						const nextChar = name[p.length];
						if (
							(isBoundary(nextChar) || p.toLowerCase() === nameLower) &&
							prefixCounts.has(p)
						) {
							finalPrefix = p;
							break;
						}
					}
				}
				prefixMap.set(`${bucketKey}||${name}`, finalPrefix);
			}
		}
		return prefixMap;
	}, [sessions]);

	const mapper = useCallback(
		(item) => {
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
		(columnId, item) => {
			switch (columnId) {
				case "name":
				case "nameWidget": {
					const style = {};

					if (item.isGroupHeader) {
						const toggleFolder = (e) => {
							e.preventDefault();
							e.stopPropagation();
							SessionsStore.update((s) => {
								const expanded = s.expandedTreeGroups || [];
								if (expanded.includes(item.prefix)) {
									s.expandedTreeGroups = expanded.filter(
										(p) => p !== item.prefix,
									);
								} else {
									s.expandedTreeGroups = [...expanded, item.prefix];
								}
							});
						};
						const icon = (
							<div className={styles.icon} onClick={toggleFolder}>
								{item.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
							</div>
						);
						const nameContent = (
							<div className={styles.nameContainer}>
								<span
									className={clsx(styles.labelText, styles.singleLine)}
									style={{ fontWeight: "bold" }}
								>
									{item.name}{" "}
									<span style={{ opacity: 0.7, fontSize: "0.9em" }}>
										({item.count})
									</span>
								</span>
							</div>
						);
						return (
							<Row onClick={toggleFolder} icons={icon}>
								{nameContent}
							</Row>
						);
					}

					const icon = (
						<div
							style={style}
							className={styles.icon}
							onClick={() => handleIconClick(item.type)}
							id={item.type}
						>
							<SessionIcon type={item.type} />
						</div>
					);

					const nameContentInner = (
						<span
							className={clsx(
								styles.labelText,
								viewMode !== "grid" && styles.singleLine,
								viewMode === "grid" && styles.gridLineClamp,
							)}
						>
							{item.name}
							{viewMode !== "grid" && (
								<div
									className={clsx(
										styles.percentageContainer,
										item.percentage && styles.visible,
									)}
								>
									<div
										className={styles.percentage}
										style={{ width: item.percentage + "%" }}
									/>
								</div>
							)}
						</span>
					);

					const nameContent = (
						<Tooltip title={item.name}>
							<div className={styles.nameContainer}>{nameContentInner}</div>
						</Tooltip>
					);

					const href = target(item);
					return viewMode === "grid" ? (
						<Label
							className={clsx(styles.labelName, styles[viewMode])}
							icon={viewMode !== "grid" && icon}
							name={nameContent}
						/>
					) : (
						<Row href={href} onClick={() => gotoItem(item)} icons={icon}>
							{nameContent}
						</Row>
					);
				}

				case "thumbnail":
				case "thumbnailWidget": {
					if (item.isGroupHeader) {
						return null;
					}
					const shouldShowImage = viewMode === "grid";
					const altIcon = (
						<>
							{item.video ? (
								<MovieIcon fontSize="large" />
							) : (
								<GraphicEqIcon fontSize="large" />
							)}
						</>
					);

					const aiBadge = item.ai && viewMode === "grid" && (
						<Tooltip title="AI Summary Available">
							<div className={styles.aiBadge}>
								<AutoAwesomeIcon />
								<span className={styles.aiText}>AI</span>
							</div>
						</Tooltip>
					);

					const progressBar = typeof item.percentage === "number" && !isNaN(item.percentage) && item.percentage > 0 && viewMode === "grid" && (
						<div className={clsx(styles.gridProgressBar, styles.visible)}>
							<div
								className={styles.gridProgressFill}
								style={{ width: item.percentage + "%" }}
							/>
						</div>
					);

					return (
						<div className={styles.thumbnailContainer}>
							<Image
								href={target(item)}
								onClick={() => gotoItem(item)}
								path={shouldShowImage ? item.thumbnail : null}
								width={viewMode === "grid" ? null : "12em"}
								height={viewMode === "grid" ? null : "9em"}
								alt={altIcon}
								loading="lazy"
							/>
							{aiBadge}
							{progressBar}
						</div>
					);
				}

				case "group":
				case "groupWidget":
					return (
						<Group
							fill={viewMode === "grid"}
							name={item.group}
							color={item.color}
							className={
								viewMode === "grid"
									? styles.gridGroupContainer
									: styles.listGroupContainer
							}
						/>
					);

				case "date": {
					if (item.isGroupHeader) {
						return null;
					}
					const formatted = formatDate(item.date);
					if (viewMode === "grid") {
						return (
							<div className={styles.gridDateBadge}>
								<span className={styles.gridDateText}>{formatted}</span>
							</div>
						);
					}
					return (
						<div className={styles.dateBadge}>
							<span className={styles.dateText}>{formatted}</span>
						</div>
					);
				}

				case "duration":
				case "durationWidget":
					return item.formattedDuration;

				case "tags":
				case "tagsWidget":
					return item.tags.length ? (
						<div className={styles.tags}>
							{item.tags.map((tag) => (
								<Chip
									key={tag}
									label={tag}
									size="small"
									className={styles.tag}
								/>
							))}
						</div>
					) : null;

				default:
					return item[columnId];
			}
		},
		[viewMode, target, gotoItem, handleIconClick, formatDate],
	);

	const treeGroupCache = useRef({});

	const treeGroup = useCallback((sortedItems, expandedTreeGroupsList) => {
		let collapsedResult;
		let groups;

		if (treeGroupCache.current.sortedItems === sortedItems) {
			collapsedResult = treeGroupCache.current.result;
			groups = treeGroupCache.current.groups;
		} else {
			groups = {};
			const groupOrder = [];

			sortedItems.forEach((itemWrapper) => {
				const { mapped } = itemWrapper;
				const groupKey = mapped.treeGroupKey;
				if (!groups[groupKey]) {
					groups[groupKey] = { prefix: mapped.treePrefix, items: [] };
					groupOrder.push(groupKey);
				}
				groups[groupKey].items.push(itemWrapper);
			});

			collapsedResult = [];
			groupOrder.forEach((groupKey) => {
				const { prefix, items } = groups[groupKey];
				if (items.length === 1) {
					collapsedResult.push(items[0]);
				} else {
					const firstItem = items[0];
					const headerMapped = {
						...firstItem.mapped,
						id: "group_" + groupKey,
						key: "group_" + groupKey,
						isGroupHeader: true,
						prefix: groupKey,
						name: prefix,
						count: items.length,
					};
					collapsedResult.push({
						raw: { ...firstItem.raw, isGroupHeader: true },
						mapped: headerMapped,
						searchableText: prefix.toLowerCase(),
					});
				}
			});

			treeGroupCache.current = { sortedItems, result: collapsedResult, groups };
		}

		if (!expandedTreeGroupsList.length) {
			return collapsedResult;
		}

		const finalResult = [];
		const expandedSet = new Set(expandedTreeGroupsList);

		for (const item of collapsedResult) {
			const isExpanded =
				item.mapped.isGroupHeader && expandedSet.has(item.mapped.prefix);

			if (isExpanded) {
				const expandedGroup = groups[item.mapped.prefix];
				// Push the header with expanded state
				finalResult.push({
					...item,
					mapped: { ...item.mapped, isExpanded: true },
				});
				// Push the children if the group exists
				if (expandedGroup) {
					const treeChildren = expandedGroup.items.map((child) => ({
						raw: child.raw,
						mapped: { ...child.mapped, isTreeChild: true },
					}));
					finalResult.push(...treeChildren);
				}
			} else {
				// Push the collapsed item or non-header item
				finalResult.push(item);
			}
		}

		return finalResult;
	}, []);

	const getSeparator = useCallback((item, prevItem, orderBy) => {
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

	useEffect(() => {
		SessionsStore.update((s) => {
			if (!isSignedIn) {
				s.mode = "signin";
				s.message = translations.REQUIRE_SIGNIN;
			} else {
				s.mode = "";
				s.message = "";
			}
		});
	}, [isSignedIn, translations]);

	// Watch for sync completion and reload sessions if needed
	const needsSessionReload = SyncActiveStore.useState(
		(s) => s.needsSessionReload,
	);
	const syncBusy = SyncActiveStore.useState((s) => s.busy);
	useEffect(() => {
		// Only reload after sync completes (not during)
		if (needsSessionReload && !syncBusy) {
			// Force session reload by clearing sessions and marking as not busy
			// This will trigger the useSessions hook to reload data
			SessionsStore.update((s) => {
				s.sessions = null;
				s.busy = false;
			});
			// Clear the flag to acknowledge the reload
			SyncActiveStore.update((s) => {
				s.needsSessionReload = false;
			});
		}
	}, [needsSessionReload, syncBusy]);

	return (
		<>
			{!isMobile && <FilterBar />}
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
				rowClassName={(item) => {
					const classes = [];
					if (item.isPlaying) classes.push(styles.playing);
					if (item.isExpanded || item.isTreeChild)
						classes.push(styles.expandedGroupHighlight);
					if (item.isTreeChild)
						classes.push(styles.treeChild);
					return classes.join(" ");
				}}
				emptyLabel={
					syncBusy ? translations.SYNCING + "..." : translations.NO_ITEMS
				}
			/>

			{!!isMobile && <FilterBar />}
		</>
	);
}
