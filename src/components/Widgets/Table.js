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
import Progress from "@/widgets/Progress";
import Error from "./Table/Error";
import Column from "./Table/Column";
import clsx from "clsx";
import RefreshIcon from '@material-ui/icons/Refresh';
import EmptyMessage from "./Table/EmptyMessage";
import { FixedSizeList as List } from 'react-window';
import ViewListIcon from '@material-ui/icons/ViewList';
import TableChartIcon from '@material-ui/icons/TableChart';
import SortIcon from '@material-ui/icons/Sort';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';

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
        marginBottom = "8em",
        loading,
        loadingElement,
        columns,
        onImport,
        onExport,
        depends = [],
        data,
        mapper,
        filter,
        refresh,
        emptyElement,
        statusBar,
        className,
        hideColumns,
        rowClick,
        error,
        store,
        itemProps = {},
        viewModeToggle = false,
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
        viewModeToggle && {
            id: "viewModeToggle",
            name: viewMode === "list" ? translations.TABLE_VIEW : translations.LIST_VIEW,
            icon: viewMode === "list" ? <TableChartIcon /> : <ViewListIcon />,
            onClick: () => {
                store.update(s => {
                    s.viewMode = s.viewMode === "list" ? "table" : "list";
                });
            }
        },
        viewMode === "list" && !!sortItems.length && {
            id: "sort",
            name: translations.SORT,
            icon: <SortIcon />,
            items: sortItems
        }
    ].filter(Boolean);

    useToolbar({ id: "Table", items: menuItems, depends: [data, name, translations, viewMode, sortItems] });

    useEffect(() => {
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
        setEmpty(!items.length);
        return items;
    }, [search, data, order, orderBy, ...depends]);

    if (!size.height) {
        return null;
    }

    const height = size.height + "px";
    const style = {
        maxHeight: height,
        maxWidth: size.width
    };

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }
    const numItems = items && items.length;
    const marginBottomInPixels = sizeToPixels(marginBottom);

    if (!loadingElement) {
        loadingElement = <Progress />;
    }

    if (!emptyElement) {
        emptyElement = <EmptyMessage />;
    }

    if (viewMode === "list") {
        const itemHeightInPixels = sizeToPixels(itemHeight);

        const Row = ({ index, style }) => {
            const item = items[index];
            const { id } = item;
            const { style: itemStyles, ...props } = itemProps;
            return <Item key={id || index} style={{ ...style, ...itemStyles }} {...props} columns={columns} rowClick={rowClick} item={item} index={index} />;
        };

        return <>
            {!!loading && loadingElement}
            {!!isEmpty && !loading && emptyElement}
            {!loading && numItems && !error && <List
                height={size.height}
                itemCount={numItems}
                itemSize={itemHeightInPixels}
                width={size.width}
            >
                {Row}
            </List>}
            {!!error && <Error error={error} />}
        </>;
    }

    const rowHeightInPixels = sizeToPixels(rowHeight);

    const tableColumns = !hideColumns && (columns || []).map((item, idx) => {
        return <Column
            key={item.id || idx}
            item={item}
            order={order}
            orderBy={orderBy}
            createSortHandler={createSortHandler} />
    });

    const itemsPerPage = parseInt((size.height - marginBottomInPixels) / rowHeightInPixels);
    const pageCount = parseInt((numItems / itemsPerPage) + ((numItems % itemsPerPage) > 0 ? 1 : 0));
    const startIdx = offset;
    const endIdx = startIdx + itemsPerPage;
    const pageIndex = parseInt(startIdx / itemsPerPage);

    const setPageIndex = index => {
        const offset = index * itemsPerPage;
        store.update(s => {
            s.offset = offset;
        });
    };

    const itemsOnPage = items.slice(startIdx, endIdx);

    const tableRows = itemsOnPage.map((item, idx) => {
        const { id } = item;
        return <Row key={id || idx} rowHeight={rowHeight} columns={columns} rowClick={rowClick} item={item} />;
    });

    return (<>
        {!!loading && loadingElement}
        {!!isEmpty && !loading && emptyElement}
        {!loading && numItems && <TableContainer className={clsx(styles.table, className)} style={style} {...otherProps}>
            {!error && <Table stickyHeader style={style}>
                {!hideColumns && <TableHead>
                    <TableRow>
                        {tableColumns}
                    </TableRow>
                </TableHead>}
                <TableBody>
                    {tableRows}
                </TableBody>
            </Table>}
            {!loading && !error && <div className={styles.footer}>
                {statusBar}
            </div>}
        </TableContainer>}
        {!!error && <Error error={error} />}
        {!loading && numItems && <Navigator
            pageIndex={pageIndex}
            setPageIndex={setPageIndex}
            pageCount={pageCount}
            numItems={numItems} />}
    </>);
}