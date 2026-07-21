import { ContentSize } from "@components/Page/Content";
import { useSearch } from "@components/Search";
import DataUsageIcon from "@icons/svg/DataUsage.svg";
import InfoIcon from "@icons/svg/Info.svg";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Message from "@widgets/Message";
import { StatusBarStore } from "@widgets/StatusBar";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useTableData } from "./hooks/useTableData";
import { useTableScroll } from "./hooks/useTableScroll";
import { useTableToolbar } from "./hooks/useTableToolbar";
import { allocateRegistryId, tableDataRegistry } from "./tableDataRegistry";
import TableTableView from "./views/TableTableView";
import { TableGridView, TableListView } from "./views/TableVirtualizedView";

const EMPTY_ARRAY = [];

export default React.memo(function TableWidget(props) {
	let {
		name,
		rowHeight = "4em",
		itemHeight = "4em",
		cellWidth = "16em",
		cellHeight = "16em",
		statusBarHeight = "4em",
		loading,
		columns,
		onImport,
		onExport,
		depends = [],
		data,
		mapper,
		filter,
		refresh,
		statusBar,
		className,
		hideColumns,
		rowClick,
		selectedRow,
		error,
		store,
		size,
		showSort = true,
		viewModes = { table: null },
		resetScrollDeps = EMPTY_ARRAY,
		treeGroup,
		getSeparator,
		expandedTreeGroups,
		renderColumn,
		rowClassName,
		emptyLabel,
		hover,
		...otherProps
	} = props;
	const translations = useTranslations();
	const isPhone = useDeviceType() === "phone";
	const isMobile = useDeviceType() !== "desktop";
	const statusBarIsActive = StatusBarStore.useState((s) => s.active);
	columns = columns || [];
	const firstColumn = columns[0];
	const defaultSort = firstColumn && (firstColumn.sortable || firstColumn.id);
	const {
		itemsPerPage = 100,
		order = "desc",
		offset = 0,
		orderBy = defaultSort,
		viewMode = "table",
	} = store.useState();

	const { listRef, gridRef, scrollOffset, handleScrollState } = useTableScroll({
		store,
		loading,
		resetScrollDeps,
	});

	const pageSize = useContext(ContentSize);
	const search = useSearch(name, () => {
		store.update((s) => {
			s.offset = 0;
		});
	});
	size = size || pageSize;

	const {
		visibleColumns,
		createSortHandler,
		sortItems,
		itemsPerPageItems,
		items,
		rawItems,
	} = useTableData({
		columns,
		store,
		viewMode,
		data,
		filter,
		mapper,
		depends,
		search,
		treeGroup,
		expandedTreeGroups,
		onExport,
		onImport,
		order,
		orderBy,
		itemsPerPage,
	});

	const registryId = useMemo(() => allocateRegistryId(), []);

	tableDataRegistry.set(registryId, { items });

	useEffect(() => {
		return () => tableDataRegistry.delete(registryId);
	}, [registryId]);

	useTableToolbar({
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
	});

	const sizeToPixels = (text) => {
		const number = parseFloat(text);
		const emPixels = (size && size.emPixels) || 16;
		const sizeInPixels = text.trim().endsWith("em")
			? number * emPixels
			: number;
		return sizeInPixels;
	};

	const itemHeightInPixels = sizeToPixels(itemHeight);
	const cellHeightInPixels = sizeToPixels(cellHeight);
	const cellWidthInPixels = sizeToPixels(cellWidth);

	const gridLayout = useMemo(() => {
		const columnCount =
			size && size.width
				? Math.floor(size.width / (cellWidthInPixels + 1)) || 1
				: 0;
		const rowCount = columnCount
			? Math.ceil(((items && items.length) || 0) / columnCount)
			: 0;
		const sidePadding =
			size && size.width
				? (size.width - columnCount * cellWidthInPixels) / 2
				: 0;
		return { columnCount, rowCount, sidePadding };
	}, [size, cellWidthInPixels, items]);

	const { columnCount, rowCount, sidePadding } = gridLayout;

	const itemData = useMemo(
		() => ({
			registryId,
			hideColumns,
			viewModes,
			viewMode,
			selectedRow,
			visibleColumns,
			rowClick,
			columnCount,
			sidePadding,
			orderBy,
			order,
			getSeparator,
			renderColumn,
			rowClassName,
		}),
		[
			registryId,
			hideColumns,
			viewModes,
			viewMode,
			selectedRow,
			visibleColumns,
			rowClick,
			columnCount,
			sidePadding,
			orderBy,
			order,
			getSeparator,
			renderColumn,
			rowClassName,
		],
	);

	const [showLoading, setShowLoading] = useState(false);
	useEffect(() => {
		if (loading) {
			const timer = setTimeout(() => setShowLoading(true), 1000);
			return () => clearTimeout(timer);
		} else {
			setShowLoading(false);
		}
	}, [loading]);

	const isEmpty = !items || !items.length;
	const [showEmpty, setShowEmpty] = useState(false);
	useEffect(() => {
		if (isEmpty) {
			const timer = setTimeout(() => setShowEmpty(true), 1000);
			return () => clearTimeout(timer);
		} else {
			setShowEmpty(false);
		}
	}, [isEmpty]);

	if (!size.height) {
		return null;
	}

	const statusBarVisible = !loading && !error && !!statusBar;
	const height =
		size.height - (!!statusBarIsActive && sizeToPixels(statusBarHeight));
	const style = {
		maxHeight: size.height + "px",
		maxWidth: size.width + "px",
	};

	const loadingElement = (
		<Message
			animated={true}
			Icon={DataUsageIcon}
			label={translations.LOADING + "..."}
		/>
	);
	const emptyElement = (
		<Message Icon={InfoIcon} label={emptyLabel || translations.NO_ITEMS} />
	);

	const sharedViewProps = {
		items,
		loading,
		error,
		statusBarVisible,
		statusBar,
		showLoading,
		showEmpty,
		loadingElement,
		emptyElement,
	};

	if (viewMode === "list" || viewMode === "tree") {
		return (
			<TableListView
				{...sharedViewProps}
				hideColumns={hideColumns}
				viewModes={viewModes}
				viewMode={viewMode}
				visibleColumns={visibleColumns}
				order={order}
				orderBy={orderBy}
				createSortHandler={createSortHandler}
				showSort={showSort}
				itemHeightInPixels={itemHeightInPixels}
				listRef={listRef}
				height={height}
				size={size}
				scrollOffset={scrollOffset}
				handleScrollState={handleScrollState}
				itemData={itemData}
			/>
		);
	}

	if (viewMode === "table") {
		return (
			<TableTableView
				{...sharedViewProps}
				visibleColumns={visibleColumns}
				hideColumns={hideColumns}
				showSort={showSort}
				order={order}
				orderBy={orderBy}
				createSortHandler={createSortHandler}
				itemsPerPage={itemsPerPage}
				offset={offset}
				store={store}
				viewModes={viewModes}
				viewMode={viewMode}
				selectedRow={selectedRow}
				rowClick={rowClick}
				getSeparator={getSeparator}
				renderColumn={renderColumn}
				rowClassName={rowClassName}
				rowHeight={rowHeight}
				className={className}
				style={style}
				otherProps={otherProps}
			/>
		);
	}

	if (viewMode === "grid") {
		return (
			<TableGridView
				{...sharedViewProps}
				columnCount={columnCount}
				rowCount={rowCount}
				cellWidthInPixels={cellWidthInPixels}
				cellHeightInPixels={cellHeightInPixels}
				gridRef={gridRef}
				height={height}
				size={size}
				scrollOffset={scrollOffset}
				handleScrollState={handleScrollState}
				itemData={itemData}
			/>
		);
	}

	return null;
});
