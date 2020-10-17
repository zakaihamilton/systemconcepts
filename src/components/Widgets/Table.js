import React, { useContext, useEffect, useMemo, useState } from "react";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import { PageSize } from "../Page";
import styles from "./Table.module.scss";
import { useTranslations } from "@/util/translations";
import { importData, exportData } from "@/util/importExport";
import Row from "./Table/Row";
import Item from "./Table/Item";
import Navigator from "./Table/Navigator";
import { useSearch } from "@/components/AppBar/Search";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import Error from "./Table/Error";
import Column from "./Table/Column";
import clsx from "clsx";
import RefreshIcon from '@material-ui/icons/Refresh';
import Message from "@/widgets/Message";
import { FixedSizeList, FixedSizeGrid } from 'react-window';
import ViewListIcon from '@material-ui/icons/ViewList';
import TableChartIcon from '@material-ui/icons/TableChart';
import ViewComfyIcon from '@material-ui/icons/ViewComfy';
import SortIcon from '@material-ui/icons/Sort';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import SyncIcon from '@material-ui/icons/Sync';
import DataUsageIcon from '@material-ui/icons/DataUsage';
import WarningIcon from '@material-ui/icons/Warning';

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

registerToolbar("Table");

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
        marginBottom = "8em",
        loading,
        syncing,
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
        error,
        store,
        viewModes = { table: null },
        ...otherProps
    } = props;
    const translations = useTranslations();
    const [isEmpty, setEmpty] = useState(false);
    columns = columns || [];
    const firstColumn = columns[0];
    const defaultSort = firstColumn && (firstColumn.sortable || firstColumn.id);
    const { order = "desc", offset = 0, orderBy = defaultSort, viewMode = "table" } = store.useState();
    const size = useContext(PageSize);
    const { search } = useSearch(() => {
        store.update(s => {
            s.offset = 0;
        });
    });

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

    const createSortHandler = (property) => () => {
        const isDesc = orderBy === property && order === "desc";
        store.update(s => {
            s.order = isDesc ? "asc" : "desc";
            s.orderBy = property;
        });
    };

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
    }, [orderBy, order]);

    const menuItems = [
        data && name && onImport && {
            id: "import",
            name: translations.IMPORT,
            icon: <PublishIcon />,
            onClick: async () => {
                let body = "";
                try {
                    body = await importData();
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
            location: "advanced"
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
            location: "advanced"
        },
        refresh && {
            id: "refresh",
            name: translations.REFRESH,
            icon: <RefreshIcon />,
            onClick: refresh,
            location: "advanced"
        },
        viewMode === "list" && !!sortItems.length && {
            id: "sort",
            name: translations.SORT,
            icon: <SortIcon />,
            items: sortItems,
            divider: true
        },
        ...viewModesList.length > 1 ? viewModesList.map(item => {
            return {
                ...item,
                selected: viewMode,
                onClick: () => {
                    store.update(s => {
                        s.viewMode = item.id;
                    });
                }
            }
        }).filter(Boolean) : []
    ].filter(Boolean);

    useToolbar({ id: "Table", items: menuItems, depends: [data, name, translations, viewMode, sortItems] });

    useEffect(() => {
        setEmpty(false);
        const hasColumn = columns.some(column => column.id === orderBy || column.sortable === orderBy);
        if (!hasColumn) {
            store.update(s => { s.orderBy = defaultSort });
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
        setEmpty(data && data.length && !items.length);
        return items;
    }, [search, data, order, orderBy, ...depends]);

    if (!size.height) {
        return null;
    }

    const height = size.height + "px";
    const style = {
        maxHeight: height + "px",
        maxWidth: size.width + "px"
    };

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }
    const numItems = items && items.length;
    const marginBottomInPixels = sizeToPixels(marginBottom);

    const syncingElement = <Message animated={true} Icon={SyncIcon} label={translations.SYNCING + "..."} />;
    const loadingElement = <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />;
    const emptyElement = <Message Icon={WarningIcon} label={translations.NO_ITEMS} />;

    if (viewMode === "list") {
        const itemHeightInPixels = sizeToPixels(itemHeight);

        const Row = ({ index, style }) => {
            const item = items[index];
            const { id } = item;
            const { style: itemStyles, ...props } = viewModes[viewMode] || {};
            return <Item
                key={id || index}
                style={{ ...style, ...itemStyles }}
                {...props}
                columns={columns}
                rowClick={rowClick}
                item={item}
                index={index}
                viewMode={viewMode}
            />;
        };

        return <>
            {!!syncing && syncingElement}
            {!!loading && !syncing && loadingElement}
            {!!isEmpty && !syncing && !loading && emptyElement}
            {!syncing && !loading && !!numItems && !error && <FixedSizeList
                height={size.height}
                itemCount={numItems}
                itemSize={itemHeightInPixels}
                width={size.width}
            >
                {Row}
            </FixedSizeList>}
            {!!error && <Error error={error} />}
        </>;
    }
    else if (viewMode === "table") {

        const rowHeightInPixels = sizeToPixels(rowHeight);

        const tableColumns = !hideColumns && (columns || []).map((item, idx) => {
            return <Column
                key={item.id || idx}
                item={item}
                order={order}
                orderBy={orderBy}
                createSortHandler={createSortHandler} />
        });

        const itemsPerPage = Math.floor((size.height - marginBottomInPixels) / rowHeightInPixels);
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
            const { id } = item;
            return <Row
                key={id || idx}
                rowHeight={rowHeight}
                columns={columns}
                rowClick={rowClick}
                item={item}
                viewMode={viewMode}
                style={style}
                {...props}
            />;
        });

        return (<>
            {!!syncing && syncingElement}
            {!!loading && !syncing && loadingElement}
            {!!isEmpty && !syncing && !loading && emptyElement}
            {!syncing && !loading && !!numItems && <TableContainer className={clsx(styles.tableContainer, className)} style={style} {...otherProps}>
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
                {!syncing && !loading && !error && <div className={styles.footer}>
                    {statusBar}
                </div>}
            </TableContainer>}
            {!!error && <Error error={error} />}
            {!syncing && !loading && numItems && <Navigator
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

        const Cell = ({ columnIndex, rowIndex, style }) => {
            const index = (rowIndex * columnCount) + columnIndex;
            const item = items[index];
            if (!item) {
                return null;
            }
            const { id } = item;
            const { style: itemStyles, ...props } = viewModes[viewMode] || {};
            return <Item
                key={id || index}
                style={{ ...style, ...itemStyles }}
                {...props}
                columns={columns}
                rowClick={rowClick}
                item={item}
                index={index}
                viewMode={viewMode}
            />;
        };

        return <>
            {!!syncing && syncingElement}
            {!!loading && !syncing && loadingElement}
            {!!isEmpty && !syncing && !loading && emptyElement}
            {!syncing && !loading && !!numItems && !error &&
                <div className={styles.grid}>
                    <FixedSizeGrid
                        columnCount={columnCount}
                        columnWidth={cellWidthInPixels}
                        rowCount={rowCount}
                        rowHeight={cellHeightInPixels}
                        height={size.height}
                        width={columnCount * cellWidthInPixels}
                    >
                        {Cell}
                    </FixedSizeGrid>
                </div>}
            {!!error && <Error error={error} />}
        </>;
    }
    else {
        return null;
    }
}