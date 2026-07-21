import { registerToolbar, useToolbar } from "@components/Toolbar";
import AccountTreeIcon from "@icons/svg/AccountTree.svg";
import GetAppIcon from "@icons/svg/GetApp.svg";
import PublishIcon from "@icons/svg/Publish.svg";
import RefreshIcon from "@icons/svg/Refresh.svg";
import SortIcon from "@icons/svg/Sort.svg";
import TableChartIcon from "@icons/svg/TableChart.svg";
import ViewComfyIcon from "@icons/svg/ViewComfy.svg";
import ViewListIcon from "@icons/svg/ViewList.svg";
import ViewStreamIcon from "@icons/svg/ViewStream.svg";
import ViewWeekIcon from "@icons/svg/ViewWeek.svg";
import IconButton from "@ui/IconButton";
import { logger as structuredLogger } from "@util/api/logger";
import { exportData, importData } from "@util/storage/importExport";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { useEffect, useMemo } from "react";
import styles from "../Table.module.css";

registerToolbar("Table", 100);

export function useTableToolbar({
	data,
	name,
	onImport,
	onExport,
	refresh,
	isMobile,
	isPhone,
	translations,
	viewMode,
	sortItems,
	showSort,
	itemsPerPageItems,
	viewModes,
	store,
	rawItems,
	visibleColumns,
	orderBy,
	defaultSort,
}) {
	const viewModesList = useMemo(
		() =>
			[
				{
					id: "table",
					icon: <TableChartIcon />,
					name: translations.TABLE_VIEW,
				},
				{
					id: "list",
					icon: <ViewListIcon />,
					name: translations.LIST_VIEW,
				},
				{
					id: "grid",
					icon: <ViewComfyIcon />,
					name: translations.GRID_VIEW,
				},
				{
					id: "tree",
					icon: <AccountTreeIcon />,
					name: translations.TREE_VIEW,
				},
				{
					id: "tracks",
					icon: <ViewWeekIcon />,
					name: translations.TRACKS_VIEW,
				},
			].filter((item) => viewModes.hasOwnProperty(item.id)),
		[translations, viewModes],
	);

	const toolbarItems = [
		data &&
			name &&
			onImport && {
				id: "import",
				name: translations.IMPORT,
				icon: <PublishIcon />,
				onClick: async () => {
					let body = "";
					try {
						({ body } = await importData());
					} catch (err) {
						if (err) {
							structuredLogger.error(err);
						}
						return;
					}
					try {
						await onImport(JSON.parse(body));
					} catch (err) {
						structuredLogger.error(err);
					}
				},
				location: "header",
				menu: "true",
			},
		!isMobile &&
			data &&
			name && {
				id: "export",
				name: translations.EXPORT,
				icon: <GetAppIcon />,
				onClick: async () => {
					let body = null;
					let type = "application/json";
					let filename = name;
					if (onExport) {
						const result = await onExport();
						if (result && typeof result === "object" && result.data) {
							body = result.data;
							if (result.type) type = result.type;
							if (result.name) filename = result.name;
						} else {
							body = result;
						}
					} else {
						body = JSON.stringify({ [name]: rawItems }, null, 4);
					}
					exportData(body, filename, type);
				},
				location: "header",
				menu: "true",
			},
		refresh && {
			id: "refresh",
			name: translations.REFRESH,
			icon: <RefreshIcon />,
			onClick: refresh,
			location: "header",
			menu: "true",
		},
		viewMode !== "table" &&
			!!sortItems.length &&
			showSort && {
				id: "sort",
				location: isPhone ? "mobile" : "header",
				name: translations.SORT,
				icon: <SortIcon />,
				items: sortItems,
				divider: true,
			},
		viewMode === "table" &&
			data &&
			data.length >= 10 && {
				id: "itemsPerPage",
				location: isPhone ? "mobile" : "header",
				name: translations.ROWS_PER_PAGE,
				icon: <ViewStreamIcon />,
				items: itemsPerPageItems,
				divider: true,
			},
	].filter(Boolean);

	const viewOptions = viewModesList.map((item) => ({
		...item,
		onClick: () => {
			store.update((s) => {
				s.viewMode = item.id;
			});
		},
	}));

	if (viewOptions.length > 1) {
		if (!isMobile) {
			const viewGroup = (
				<div className={styles.viewGroup}>
					{viewOptions.map((item) => {
						const isSelected = viewMode === item.id;
						return (
							<Tooltip title={item.name} key={item.id}>
								<IconButton
									onClick={item.onClick}
									className={clsx(
										styles.viewGroupButton,
										isSelected && styles.selected,
									)}
									size="small"
									aria-label={item.name}
								>
									{item.icon}
								</IconButton>
							</Tooltip>
						);
					})}
				</div>
			);
			toolbarItems.push({
				id: "viewGroup",
				element: viewGroup,
				location: "header",
			});
		}
	}

	useToolbar({
		id: "Table",
		items: toolbarItems,
		depends: [
			rawItems,
			name,
			translations,
			viewMode,
			sortItems,
			itemsPerPageItems,
		],
	});

	useEffect(() => {
		const hasColumn = visibleColumns.some(
			(column) => column.id === orderBy || column.sortable === orderBy,
		);
		if (!hasColumn) {
			store.update((s) => {
				s.orderBy = defaultSort;
			});
		}
	}, [visibleColumns, orderBy, defaultSort, store]);
}
