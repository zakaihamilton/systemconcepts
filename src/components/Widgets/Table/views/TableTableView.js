import LinearProgress from "@ui/LinearProgress";
import Table from "@ui/Table";
import TableBody from "@ui/TableBody";
import TableContainer from "@ui/TableContainer";
import TableHead from "@ui/TableHead";
import TableRow from "@ui/TableRow";
import clsx from "clsx";
import Error from "../Error";
import Navigator from "../Navigator";
import Row from "../Row";
import styles from "../Table.module.css";
import TableColumn from "../TableColumn";

export default function TableTableView({
	items,
	visibleColumns,
	hideColumns,
	showSort,
	order,
	orderBy,
	createSortHandler,
	itemsPerPage,
	offset,
	store,
	viewModes,
	viewMode,
	selectedRow,
	rowClick,
	getSeparator,
	renderColumn,
	rowClassName,
	rowHeight,
	className,
	loading,
	error,
	statusBarVisible,
	statusBar,
	showLoading,
	showEmpty,
	loadingElement,
	emptyElement,
	style,
	otherProps,
}) {
	const numItems = items && items.length;

	const tableColumns =
		!hideColumns &&
		(visibleColumns || []).map((item, idx) => {
			return (
				<TableColumn
					key={item.id || idx}
					item={item}
					showSort={showSort}
					order={order}
					orderBy={orderBy}
					createSortHandler={createSortHandler}
					stickyHeader
				/>
			);
		});

	const pageCount = Math.ceil(numItems / itemsPerPage);
	const startIdx = offset;
	const endIdx = startIdx + itemsPerPage;
	const pageIndex = Math.ceil(startIdx / itemsPerPage);

	const setPageIndex = (index) => {
		const offset = index * itemsPerPage;
		store.update((s) => {
			s.offset = offset;
		});
	};

	const itemsOnPage = items.slice(startIdx, endIdx);

	const tableRows = itemsOnPage.map((item, idx) => {
		const { style, ...props } = viewModes[viewMode] || {};
		const { id, key } = item;
		const selected = selectedRow && selectedRow(item);
		const itemIndex = startIdx + idx;
		let separator = false;
		if (getSeparator && itemIndex > 0) {
			const prevItem = items[itemIndex - 1];
			if (item && prevItem) {
				separator = getSeparator(item, prevItem, orderBy, viewMode);
			}
		}
		const className = rowClassName ? rowClassName(item) : "";
		return (
			<Row
				key={key || id || idx}
				index={idx}
				rowHeight={rowHeight}
				columns={visibleColumns}
				rowClick={rowClick}
				item={item}
				viewMode={viewMode}
				style={style}
				selected={selected}
				separator={separator}
				renderColumn={renderColumn}
				className={clsx(props.className, className)}
				{...props}
			/>
		);
	});

	const loader = (
		<div className={clsx(styles.loader, loading && styles.loading)}>
			<LinearProgress />
		</div>
	);

	return (
		<>
			{!!showLoading && !numItems && loadingElement}
			{!!showEmpty && !loading && emptyElement}
			{!!numItems && (
				<TableContainer
					className={clsx(
						styles.tableContainer,
						className,
						loading && styles.loading,
					)}
					style={style}
					{...otherProps}
				>
					{!!statusBarVisible && statusBar}
					{loader}
					{!error && (
						<Table classes={{ root: styles.table }} stickyHeader style={style}>
							{hideColumns && (
								<colgroup>
									{visibleColumns.map((column) => (
										<col key={column.id} style={column.columnProps?.style} />
									))}
								</colgroup>
							)}
							{!hideColumns && (
								<TableHead>
									<TableRow>{tableColumns}</TableRow>
								</TableHead>
							)}
							<TableBody>{tableRows}</TableBody>
						</Table>
					)}
				</TableContainer>
			)}
			{!!error && <Error error={error} />}
			{!loading && !!numItems && (
				<Navigator
					pageIndex={pageIndex}
					setPageIndex={setPageIndex}
					pageCount={pageCount}
					numItems={numItems}
				/>
			)}
		</>
	);
}
