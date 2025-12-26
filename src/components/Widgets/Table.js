import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { ContentSize } from "@components/Page/Content";
import styles from "./Table.module.scss";
import { useTranslations } from "@util/translations";
import { useDeviceType } from "@util/styles";
import { importData, exportData } from "@util/importExport";
import Row from "./Table/Row";
import Item from "./Table/Item";
import Navigator from "./Table/Navigator";
import { useSearch } from "@components/Search";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from "@mui/icons-material/GetApp";
import PublishIcon from "@mui/icons-material/Publish";
import Error from "./Table/Error";
import TableColumn from "./Table/TableColumn";
import clsx from "clsx";
import RefreshIcon from "@mui/icons-material/Refresh";
import Message from "@widgets/Message";
import { FixedSizeList, FixedSizeGrid } from "react-window";
import ViewListIcon from "@mui/icons-material/ViewList";
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import SortIcon from "@mui/icons-material/Sort";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import InfoIcon from "@mui/icons-material/Info";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import { StatusBarStore } from "@widgets/StatusBar";
import ListColumns from "./Table/ListColumns";

import { getComparator, stableSort } from "@util/sort";

// Stable empty array to prevent unnecessary re-renders
const EMPTY_ARRAY = [];

registerToolbar("Table", 100);

export default function TableWidget(props) {
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
        getSeparator,
        ...otherProps
    } = props;
    const translations = useTranslations();
    const isMobile = useDeviceType() !== "desktop";
    const [isEmpty, setEmpty] = useState(false);
    const statusBarIsActive = StatusBarStore.useState(s => s.active);
    columns = columns || [];
    const firstColumn = columns[0];
    const defaultSort = firstColumn && (firstColumn.sortable || firstColumn.id);
    const { itemsPerPage = 100, order = "desc", offset = 0, orderBy = defaultSort, viewMode = "table" } = store.useState();
    const { scrollOffset = 0 } = store.useState(s => ({ scrollOffset: s.scrollOffset }));
    const listRef = React.useRef();
    const gridRef = React.useRef();
    const hasRestoredScrollRef = React.useRef(false);
    const lastResetDepsRef = React.useRef(resetScrollDeps);

    // Handle scroll position restoration after component mounts or data loads
    useEffect(() => {
        if (!loading && scrollOffset > 0 && !hasRestoredScrollRef.current) {
            // Restore scroll position after a brief delay to ensure DOM is ready
            const timer = setTimeout(() => {
                if (listRef.current) {
                    listRef.current.scrollTo(scrollOffset);
                }
                if (gridRef.current) {
                    gridRef.current.scrollTo({ scrollTop: scrollOffset });
                }
                hasRestoredScrollRef.current = true;
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [loading, scrollOffset]);

    // Reset scroll position when filters change
    useEffect(() => {
        // Check if resetScrollDeps actually changed (deep comparison)
        const depsChanged = JSON.stringify(lastResetDepsRef.current) !== JSON.stringify(resetScrollDeps);
        lastResetDepsRef.current = resetScrollDeps;

        if (depsChanged && resetScrollDeps.length > 0) {
            // Reset scroll position
            if (listRef.current) {
                listRef.current.scrollTo(0);
            }
            if (gridRef.current) {
                gridRef.current.scrollTo({ scrollTop: 0 });
            }
            // Update store
            store.update(s => {
                s.scrollOffset = 0;
            });
            hasRestoredScrollRef.current = true; // Prevent restoration after reset
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...resetScrollDeps]);

    // Save scroll position on user scroll (debounced)
    const saveScrollPosition = React.useCallback((offset) => {
        store.update(s => {
            s.scrollOffset = offset;
        });
    }, [store]);

    const debouncedSaveScroll = React.useMemo(() => {
        let timeoutId;
        return (offset) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => saveScrollPosition(offset), 300);
        };
    }, [saveScrollPosition]);
    const pageSize = useContext(ContentSize);
    const search = useSearch(name, () => {
        store.update(s => {
            s.offset = 0;
        });
    });
    size = size || pageSize;

    const viewModesList = [
        {
            id: "table",
            icon: <TableChartIcon />,
            name: translations.TABLE_VIEW
        },
        {
            id: "list",
            icon: <ViewListIcon />,
            name: translations.LIST_VIEW
        },
        {
            id: "grid",
            icon: <ViewComfyIcon />,
            name: translations.GRID_VIEW
        }
    ].filter(item => viewModes.hasOwnProperty(item.id));

    const visibleColumns = useMemo(() => columns.filter(column => {
        if (!column) {
            return false;
        }
        if (column.viewModes) {
            return column.viewModes.hasOwnProperty(viewMode);
        }
        return true;
    }), [columns, viewMode]);

    const createSortHandler = useCallback((property) => () => {
        const isDesc = orderBy === property && order === "desc";
        store.update(s => {
            s.order = isDesc ? "asc" : "desc";
            s.orderBy = property;
        });
    }, [order, orderBy, store]);

    const sortItems = useMemo(() => {
        return (columns || []).filter(column => column.sortable).map(column => {
            const { sortable, id, title } = column;
            const sortId = typeof sortable === "string" ? sortable : id;
            return {
                id: id,
                name: title,
                icon: orderBy === sortId ? (order === "asc" ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : null,
                selected: orderBy === sortId,
                onClick: createSortHandler(sortId)
            };
        });
    }, [columns, orderBy, order, createSortHandler]);

    const itemsPerPageItems = useMemo(() => {
        return [10, 25, 50, 75, 100].map(num => {
            return {
                id: num,
                name: num,
                icon: null,
                selected: itemsPerPage,
                onClick: () => store.update(s => {
                    s.itemsPerPage = num;
                })
            };
        });
    }, [itemsPerPage, store]);

    const toolbarItems = [
        data && name && onImport && {
            id: "import",
            name: translations.IMPORT,
            icon: <PublishIcon />,
            onClick: async () => {
                let body = "";
                try {
                    ({ body } = await importData());
                }
                catch (err) {
                    if (err) {
                        console.error(err);
                    }
                    return;
                }
                try {
                    await onImport(JSON.parse(body));
                }
                catch (err) {
                    console.error(err);
                }
            },
            location: "header",
            menu: "true"
        },
        data && name && {
            id: "export",
            name: translations.EXPORT,
            icon: <GetAppIcon />,
            onClick: async () => {
                let body = null;
                if (onExport) {
                    body = await onExport();
                }
                else {
                    body = JSON.stringify({ [name]: data }, null, 4);
                }
                exportData(body, name, "application/json");
            },
            location: "header",
            menu: "true"
        },
        refresh && {
            id: "refresh",
            name: translations.REFRESH,
            icon: <RefreshIcon />,
            onClick: refresh,
            location: "header",
            menu: "true"
        },
        viewMode !== "table" && !!sortItems.length && showSort && {
            id: "sort",
            location: isMobile ? "mobile" : "header",
            name: translations.SORT,
            icon: <SortIcon />,
            items: sortItems,
            divider: true
        },
        viewMode === "table" && data && data.length >= 10 && {
            id: "itemsPerPage",
            location: "header",
            name: translations.ROWS_PER_PAGE,
            icon: <ViewStreamIcon />,
            items: itemsPerPageItems,
            divider: true,
            menu: isMobile
        },
    ].filter(Boolean);

    const viewOptions = viewModesList.map(item => ({
        ...item,
        onClick: () => {
            store.update(s => {
                s.viewMode = item.id;
            });
        }
    }));

    const currentViewOption = viewOptions.find(item => item.id === viewMode);

    if (viewOptions.length > 1) {
        if (isMobile) {
            toolbarItems.push({
                id: "view",
                name: currentViewOption ? currentViewOption.name : translations.TABLE_VIEW,
                icon: currentViewOption ? currentViewOption.icon : <TableChartIcon />,
                location: "mobile",
                menu: false,
                items: viewOptions,
                selected: viewMode
            });
        } else {
            toolbarItems.push(...viewOptions.map(item => ({
                ...item,
                selected: viewMode,
                location: "header",
                menu: false
            })));
        }
    }

    useToolbar({ id: "Table", items: toolbarItems, depends: [data, name, translations, viewMode, sortItems, itemsPerPage] });

    useEffect(() => {
        setEmpty(false);
        const hasColumn = visibleColumns.some(column => column.id === orderBy || column.sortable === orderBy);
        if (!hasColumn) {
            store.update(s => { s.orderBy = defaultSort; });
        }
    }, []);

    useEffect(() => {
        if (loading) {
            setEmpty(false);
        }
    }, [loading]);

    const items = useMemo(() => {
        let items = data || [];
        if (filter) {
            items = items.filter(filter);
        }
        if (mapper) {
            items = items.map(mapper);
        }

        if (search) {
            const keys = visibleColumns.filter(item => typeof item.searchable === "undefined" || item.searchable).map(item => {
                if (typeof item.searchable === "string") {
                    return item.searchable;
                }
                if (typeof item.sortable === "string") {
                    return item.sortable;
                }
                return item.id;
            });
            items = items.filter(item => {
                for (const key of keys) {
                    if (typeof item[key] === "string") {
                        const match = item[key].toLowerCase().includes(search.toLowerCase());
                        if (match) {
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        items = stableSort(items || [], getComparator(order, orderBy));
        setEmpty(data && (!data.length || !items.length));
        return items;
    }, [search, data, order, orderBy, visibleColumns, filter, mapper, ...depends]);

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * (size && size.emPixels) : number;
        return sizeInPixels;
    };

    const itemHeightInPixels = sizeToPixels(itemHeight);
    const cellHeightInPixels = sizeToPixels(cellHeight);
    const cellWidthInPixels = sizeToPixels(cellWidth);

    // Memoize expensive grid calculations
    const gridLayout = useMemo(() => {
        const columnCount = size && size.width ? (Math.floor(size.width / (cellWidthInPixels + 1)) || 1) : 0;
        const rowCount = columnCount ? Math.ceil((items && items.length || 0) / columnCount) : 0;
        const sidePadding = size && size.width ? ((size.width - (columnCount * cellWidthInPixels)) / 2) : 0;
        return { columnCount, rowCount, sidePadding };
    }, [size?.width, cellWidthInPixels, items?.length]);

    const { columnCount, rowCount, sidePadding } = gridLayout;

    const itemData = useMemo(() => ({
        hideColumns,
        items,
        viewModes,
        viewMode,
        selectedRow,
        visibleColumns,
        rowClick,
        columnCount,
        sidePadding,
        orderBy,
        order,
        getSeparator
    }), [hideColumns, items, viewModes, viewMode, selectedRow, visibleColumns, rowClick, columnCount, sidePadding, orderBy, order, getSeparator]);

    const innerElementType = useMemo(() => {
        const Inner = forwardRef(({ children, ...rest }, ref) => {
            const { style: itemStyles, columnStyles, ...props } = viewModes[viewMode] || {};
            const style = {
                top: 0, left: 0, width: "100%", height: itemHeightInPixels + "px"
            };
            return <div ref={ref} {...rest}>
                {!hideColumns && <ListColumns key={0} columns={visibleColumns} style={{ ...style, ...itemStyles }} {...props} />}
                {children}
            </div>;
        });
        Inner.displayName = "innerElementType";
        return Inner;
    }, [viewMode, viewModes, itemHeightInPixels, hideColumns, visibleColumns]);

    if (!size.height) {
        return null;
    }

    const statusBarVisible = !loading && !error && !!statusBar;
    const height = size.height - (!!statusBarIsActive && sizeToPixels(statusBarHeight));
    const style = {
        maxHeight: size.height + "px",
        maxWidth: size.width + "px"
    };

    const numItems = items && items.length;

    const loadingElement = <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />;
    const emptyElement = <Message Icon={InfoIcon} label={translations.NO_ITEMS} />;

    if (viewMode === "list") {
        const itemCount = hideColumns ? numItems : numItems + 1;

        return <>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!!statusBarVisible && statusBar}
            {!loading && !!numItems && !error && <FixedSizeList
                className={styles.tableList}
                ref={listRef}
                height={height}
                innerElementType={innerElementType}
                itemCount={itemCount}
                itemSize={itemHeightInPixels}
                width={size.width}
                initialScrollOffset={scrollOffset}
                onScroll={({ scrollOffset }) => {
                    debouncedSaveScroll(scrollOffset);
                }}
                itemData={itemData}
            >
                {TableListRow}
            </FixedSizeList>}
            {!!error && <Error error={error} />}
        </>;
    }
    else if (viewMode === "table") {
        const tableColumns = !hideColumns && (visibleColumns || []).map((item, idx) => {
            return <TableColumn
                key={item.id || idx}
                item={item}
                showSort={showSort}
                order={order}
                orderBy={orderBy}
                createSortHandler={createSortHandler} />;
        });

        const pageCount = Math.ceil(numItems / itemsPerPage);
        const startIdx = offset;
        const endIdx = startIdx + itemsPerPage;
        const pageIndex = Math.ceil(startIdx / itemsPerPage);

        const setPageIndex = index => {
            const offset = index * itemsPerPage;
            store.update(s => {
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
            return <Row
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
                {...props}
            />;
        });

        return (<>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!loading && !!numItems && <TableContainer className={clsx(styles.tableContainer, className)} style={style} {...otherProps}>
                {!!statusBarVisible && statusBar}
                {!error && <Table classes={{ root: styles.table }} stickyHeader style={style}>
                    {!hideColumns && <TableHead>
                        <TableRow>
                            {tableColumns}
                        </TableRow>
                    </TableHead>}
                    <TableBody>
                        {tableRows}
                    </TableBody>
                </Table>}
            </TableContainer>}
            {!!error && <Error error={error} />}
            {!loading && !!numItems && <Navigator
                pageIndex={pageIndex}
                setPageIndex={setPageIndex}
                pageCount={pageCount}
                numItems={numItems} />}
        </>);
    }
    else if (viewMode === "grid") {
        return <>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!!statusBarVisible && statusBar}
            {!loading && !!numItems && !error && <FixedSizeGrid
                className={styles.grid}
                ref={gridRef}
                columnCount={columnCount}
                columnWidth={cellWidthInPixels}
                rowCount={rowCount}
                rowHeight={cellHeightInPixels}
                height={height}
                width={size.width}
                initialScrollTop={scrollOffset}
                onScroll={({ scrollTop }) => {
                    debouncedSaveScroll(scrollTop);
                }}
                itemData={itemData}
            >
                {TableGridCell}
            </FixedSizeGrid>}
            {!!error && <Error error={error} />}
        </>;
    }
    else {
        return null;
    }
}

const TableListRow = ({ index, style, data }) => {
    const { hideColumns, items, viewModes, viewMode, selectedRow, visibleColumns, rowClick, orderBy, getSeparator } = data;
    const itemIndex = hideColumns ? index : index - 1;
    const item = items[itemIndex];
    const { id, key } = item || {};
    const { style: itemStyles, columnStyles, ...props } = viewModes[viewMode] || {};
    const selected = index && selectedRow && selectedRow(item);

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

    return <Item
        key={key || id || itemIndex}
        style={{ ...style, ...itemStyles }}
        {...props}
        columns={visibleColumns}
        rowClick={rowClick}
        item={item}
        index={itemIndex}
        viewMode={viewMode}
        selected={selected}
        separator={separator}
    />;
};

const TableGridCell = ({ columnIndex, rowIndex, style, data }) => {
    const { columnCount, items, viewModes, viewMode, selectedRow, sidePadding, visibleColumns, rowClick } = data;
    const index = (rowIndex * columnCount) + columnIndex;
    const item = items[index];
    if (!item) {
        return null;
    }
    const { id, key } = item;
    const { style: itemStyles, ...props } = viewModes[viewMode] || {};
    const selected = selectedRow && selectedRow(item);

    const finalStyle = { ...style };
    finalStyle.left += sidePadding;

    return <Item
        key={id || key || index}
        style={{ ...finalStyle, ...itemStyles }}
        {...props}
        columns={visibleColumns}
        rowClick={rowClick}
        item={item}
        index={index}
        viewMode={viewMode}
        selected={selected}
    />;
};
