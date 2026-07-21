import FixedSizeGrid from "@components/Virtualized/FixedSizeGrid";
import FixedSizeList from "@components/Virtualized/FixedSizeList";
import LinearProgress from "@ui/LinearProgress";
import clsx from "clsx";
import React, { forwardRef, useMemo } from "react";
import Error from "../Error";
import Item from "../Item";
import ListColumns from "../ListColumns";
import styles from "../Table.module.css";
import { tableDataRegistry } from "../tableDataRegistry";

const TableListRow = React.memo(({ index, style, data }) => {
	const {
		registryId,
		hideColumns,
		viewModes,
		viewMode,
		selectedRow,
		visibleColumns,
		rowClick,
		orderBy,
		getSeparator,
		renderColumn,
		rowClassName,
	} = data;
	const { items } = tableDataRegistry.get(registryId) || {};
	const itemIndex = hideColumns ? index : index - 1;
	const item = items?.[itemIndex];

	if (!item) return null;

	const { id, key } = item;
	const {
		style: itemStyles,
		columnStyles: _columnStyles,
		...props
	} = viewModes[viewMode] || {};
	const selected = index && selectedRow && selectedRow(item);
	const className = rowClassName ? rowClassName(item) : "";

	if (!hideColumns && !index) {
		return null;
	}

	let separator = false;
	if (getSeparator && itemIndex > 0) {
		const prevItem = items[itemIndex - 1];
		if (item && prevItem) {
			separator = getSeparator(item, prevItem, orderBy, viewMode);
		}
	}

	return (
		<>
			<Item
				key={key || id || itemIndex}
				style={{ ...style, ...itemStyles }}
				{...props}
				className={clsx(props.className, className)}
				columns={visibleColumns}
				rowClick={rowClick}
				item={item}
				index={itemIndex}
				viewMode={viewMode}
				selected={selected}
				separator={separator}
				renderColumn={renderColumn}
			/>
		</>
	);
});

TableListRow.displayName = "TableListRow";

const TableGridCell = React.memo(({ columnIndex, rowIndex, style, data }) => {
	const {
		registryId,
		columnCount,
		viewModes,
		viewMode,
		selectedRow,
		sidePadding,
		visibleColumns,
		rowClick,
		renderColumn,
		rowClassName,
	} = data;
	const { items } = tableDataRegistry.get(registryId) || {};
	const index = rowIndex * columnCount + columnIndex;
	const item = items?.[index];
	if (!item) {
		return null;
	}
	const { id, key } = item;
	const { style: itemStyles, ...props } = viewModes[viewMode] || {};
	const selected = selectedRow && selectedRow(item);
	const className = rowClassName ? rowClassName(item) : "";

	const finalStyle = { ...style };
	finalStyle.left += sidePadding;

	return (
		<Item
			key={id || key || index}
			style={{ ...finalStyle, ...itemStyles }}
			{...props}
			className={clsx(props.className, className)}
			columns={visibleColumns}
			rowClick={rowClick}
			item={item}
			index={index}
			viewMode={viewMode}
			selected={selected}
			renderColumn={renderColumn}
		/>
	);
});

TableGridCell.displayName = "TableGridCell";

export function TableListView({
	items,
	hideColumns,
	viewModes,
	viewMode,
	visibleColumns,
	order,
	orderBy,
	createSortHandler,
	showSort,
	itemHeightInPixels,
	listRef,
	height,
	size,
	scrollOffset,
	handleScrollState,
	itemData,
	loading,
	error,
	statusBarVisible,
	statusBar,
	showLoading,
	showEmpty,
	loadingElement,
	emptyElement,
}) {
	const numItems = items && items.length;
	const itemCount = hideColumns ? numItems : numItems + 1;

	const innerElementType = useMemo(() => {
		const Inner = forwardRef(({ children, ...rest }, ref) => {
			const {
				style: itemStyles,
				columnStyles: _columnStyles,
				...props
			} = viewModes[viewMode] || {};
			const style = {
				top: 0,
				left: 0,
				width: "100%",
				height: itemHeightInPixels + "px",
			};
			return (
				<div ref={ref} {...rest}>
					{!hideColumns && (
						<ListColumns
							key={0}
							columns={visibleColumns}
							style={{ ...style, ...itemStyles }}
							{...props}
							order={order}
							orderBy={orderBy}
							onSort={createSortHandler}
							showSort={showSort}
						/>
					)}
					{children}
				</div>
			);
		});
		Inner.displayName = "innerElementType";
		return Inner;
	}, [
		viewMode,
		viewModes,
		itemHeightInPixels,
		hideColumns,
		visibleColumns,
		order,
		orderBy,
		createSortHandler,
		showSort,
	]);

	const loader = (
		<div className={clsx(styles.loader, loading && styles.loading)}>
			<LinearProgress />
		</div>
	);

	return (
		<>
			{!!showLoading && !numItems && loadingElement}
			{!!showEmpty && !loading && emptyElement}
			{!!statusBarVisible && statusBar}
			{loader}
			{!!numItems && !error && (
				<FixedSizeList
					className={clsx(styles.tableList, loading && styles.loading)}
					ref={listRef}
					height={height}
					innerElementType={innerElementType}
					itemCount={itemCount}
					itemSize={itemHeightInPixels}
					width={size.width}
					overscanCount={1}
					initialScrollOffset={scrollOffset}
					onScroll={({ scrollOffset }) => {
						handleScrollState(scrollOffset);
					}}
					itemData={itemData}
				>
					{TableListRow}
				</FixedSizeList>
			)}
			{!!error && <Error error={error} />}
		</>
	);
}

export function TableGridView({
	items,
	columnCount,
	rowCount,
	cellWidthInPixels,
	cellHeightInPixels,
	gridRef,
	height,
	size,
	scrollOffset,
	handleScrollState,
	itemData,
	loading,
	error,
	statusBarVisible,
	statusBar,
	showLoading,
	showEmpty,
	loadingElement,
	emptyElement,
}) {
	const numItems = items && items.length;

	const loader = (
		<div className={clsx(styles.loader, loading && styles.loading)}>
			<LinearProgress />
		</div>
	);

	return (
		<>
			{!!showLoading && !numItems && loadingElement}
			{!!showEmpty && !loading && emptyElement}
			{!!statusBarVisible && statusBar}
			{loader}
			{!!numItems && !error && (
				<FixedSizeGrid
					className={clsx(styles.grid, loading && styles.loading)}
					ref={gridRef}
					columnCount={columnCount}
					columnWidth={cellWidthInPixels}
					rowCount={rowCount}
					rowHeight={cellHeightInPixels}
					height={height}
					width={size.width}
					overscanRowCount={1}
					overscanColumnCount={0}
					initialScrollTop={scrollOffset}
					onScroll={({ scrollTop }) => {
						handleScrollState(scrollTop);
					}}
					itemData={itemData}
				>
					{TableGridCell}
				</FixedSizeGrid>
			)}
			{!!error && <Error error={error} />}
		</>
	);
}
