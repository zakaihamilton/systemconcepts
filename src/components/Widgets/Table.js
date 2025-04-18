import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { ContentSize } from "@components/Page/Content";
import styles from "./Table.module.scss";
import { useTranslations } from "@util/translations";
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

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

registerToolbar("Table", 100);

function descendingComparator(a, b, orderBy) {
    const aText = a && a[orderBy] || "";
    const bText = b && b[orderBy] || "";
    return collator.compare(aText, bText);
}

function getComparator(order, orderBy) {
    return order === "desc"
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

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
        ...otherProps
    } = props;
    const translations = useTranslations();
    const [isEmpty, setEmpty] = useState(false);
    const statusBarIsActive = StatusBarStore.useState(s => s.active);
    columns = columns || [];
    const firstColumn = columns[0];
    const defaultSort = firstColumn && (firstColumn.sortable || firstColumn.id);
    const { itemsPerPage = 100, order = "desc", offset = 0, orderBy = defaultSort, viewMode = "table" } = store.useState();
    const pageSize = useContext(ContentSize);
    const search = useSearch(() => {
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

    columns = columns.filter(column => {
        if (!column) {
            return false;
        }
        if (column.viewModes) {
            return column.viewModes.hasOwnProperty(viewMode);
        }
        return true;
    });

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
            location: "header",
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
            divider: true
        },
        ...(viewModesList.length > 1 ? viewModesList.map(item => {
            return {
                ...item,
                selected: viewMode,
                onClick: () => {
                    store.update(s => {
                        s.viewMode = item.id;
                    });
                }
            };
        }).filter(Boolean) : [])
    ].filter(Boolean);

    useToolbar({ id: "Table", items: toolbarItems, depends: [data, name, translations, viewMode, sortItems, itemsPerPage] });

    useEffect(() => {
        setEmpty(false);
        const hasColumn = columns.some(column => column.id === orderBy || column.sortable === orderBy);
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

        items = items.filter(item => {
            if (!search) {
                return true;
            }
            const keys = columns.filter(item => typeof item.searchable === "undefined" || item.searchable).map(item => {
                if (typeof item.searchable === "string") {
                    return item.searchable;
                }
                if (typeof item.sortable === "string") {
                    return item.sortable;
                }
                return item.id;
            });
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

        items = stableSort(items || [], getComparator(order, orderBy));
        setEmpty(data && (!data.length || !items.length));
        return items;
    }, [search, data, order, orderBy, ...depends]);

    if (!size.height) {
        return null;
    }

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    };

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
        const itemHeightInPixels = sizeToPixels(itemHeight);
        const itemCount = hideColumns ? numItems : numItems + 1;

        const innerElementType = forwardRef(({ children, ...rest }, ref) => {
            const { style: itemStyles, columnStyles, ...props } = viewModes[viewMode] || {};
            const style = {
                top: 0, left: 0, width: "100%", height: itemHeightInPixels + "px"
            };
            return <div ref={ref} {...rest}>
                {!hideColumns && <ListColumns key={0} columns={columns} style={{ ...style, ...itemStyles }} {...props} />}
                {children}
            </div>;
        });
        innerElementType.displayName = "innerElementType";

        const Row = ({ index, style }) => {
            const itemIndex = hideColumns ? index : index - 1;
            const item = items[itemIndex];
            const { id, key } = item || {};
            const { style: itemStyles, columnStyles, ...props } = viewModes[viewMode] || {};
            const selected = index && selectedRow && selectedRow(item);
            if (!hideColumns && !index) {
                return null;
            }
            return <Item
                key={key || id || itemIndex}
                style={{ ...style, ...itemStyles }}
                {...props}
                columns={columns}
                rowClick={rowClick}
                item={item}
                index={itemIndex}
                viewMode={viewMode}
                selected={selected}
            />;
        };

        return <>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!!statusBarVisible && statusBar}
            {!loading && !!numItems && !error && <FixedSizeList
                className={styles.tableList}
                height={height}
                innerElementType={innerElementType}
                itemCount={itemCount}
                itemSize={itemHeightInPixels}
                width={size.width}
            >
                {Row}
            </FixedSizeList>}
            {!!error && <Error error={error} />}
        </>;
    }
    else if (viewMode === "table") {
        const tableColumns = !hideColumns && (columns || []).map((item, idx) => {
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
            return <Row
                key={key || id || idx}
                index={idx}
                rowHeight={rowHeight}
                columns={columns}
                rowClick={rowClick}
                item={item}
                viewMode={viewMode}
                style={style}
                selected={selected}
                {...props}
            />;
        });

        return (<>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!loading && !!numItems && <TableContainer className={clsx(styles.tableContainer, className)} style={style} {...otherProps}>
                {!!statusBarVisible && statusBar}
                {!error && <Table className={styles.table} stickyHeader style={style}>
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
        const cellHeightInPixels = sizeToPixels(cellHeight);
        const cellWidthInPixels = sizeToPixels(cellWidth);
        const columnCount = Math.floor(size.width / (cellWidthInPixels + 1));
        const rowCount = Math.ceil(numItems / columnCount);
        const sidePadding = (size.width - (columnCount * cellWidthInPixels)) / 2;

        const Cell = ({ columnIndex, rowIndex, style }) => {
            const index = (rowIndex * columnCount) + columnIndex;
            const item = items[index];
            if (!item) {
                return null;
            }
            const { id, key } = item;
            const { style: itemStyles, ...props } = viewModes[viewMode] || {};
            const selected = selectedRow && selectedRow(item);
            style = { ...style };
            style.left += sidePadding;
            return <Item
                key={id || key || index}
                style={{ ...style, ...itemStyles }}
                {...props}
                columns={columns}
                rowClick={rowClick}
                item={item}
                index={index}
                viewMode={viewMode}
                selected={selected}
            />;
        };

        return <>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!!statusBarVisible && statusBar}
            {!loading && !!numItems && !error && <FixedSizeGrid
                className={styles.grid}
                columnCount={columnCount}
                columnWidth={cellWidthInPixels}
                rowCount={rowCount}
                rowHeight={cellHeightInPixels}
                height={size.height}
                width={size.width}
            >
                {Cell}
            </FixedSizeGrid>}
            {!!error && <Error error={error} />}
        </>;
    }
    else {
        return null;
    }
}