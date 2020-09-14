import React, { useContext, useEffect, useMemo } from "react";
import clsx from "clsx";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import { PageSize } from "../Page";
import styles from "./Table.module.scss";
import { useTranslations } from "@/util/translations";
import { importData, exportData } from "@/util/importExport";
import Row from "./Table/Row";
import Navigator from "./Table/Navigator";
import Label from "@/widgets/Label";
import { useSearch } from "@/components/AppBar/Search";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import Chip from '@material-ui/core/Chip';
import CancelIcon from '@material-ui/icons/Cancel';
import Tooltip from '@material-ui/core/Tooltip';
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import Progress from "@/widgets/Progress";

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

export default function TableWidget({ name, rowHeight = "4em", marginBottom = "8em", loading, columns, onImport, onExport, depends = [], reset = [], sortColumn, data, mapper, filter, empty, statusBar, className, hideColumns, rowClick, ...props }) {
    const translations = useTranslations();
    const [order, setOrder] = React.useState("desc");
    const [offset, setOffset] = React.useState(0);
    columns = columns || [];
    const firstColumn = columns[0];
    const defaultSort = sortColumn || (firstColumn && (firstColumn.sortable || firstColumn.id));
    const [orderBy, setOrderBy] = React.useState(defaultSort);
    const size = useContext(PageSize);
    const { search } = useSearch();

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
            }
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
            }
        }
    ].filter(Boolean);

    useToolbar({ id: "Table", items: menuItems, depends: [data, name] });

    useEffect(() => {
        setOffset(0);
    }, [data, search, ...reset]);

    useEffect(() => {
        const hasColumn = columns.some(column => column.id === orderBy || column.sortable === orderBy);
        if (!hasColumn) {
            setOrderBy(defaultSort);
        }
    });

    const createSortHandler = (property) => () => {
        const isDesc = orderBy === property && order === "desc";
        setOrder(isDesc ? "asc" : "desc");
        setOrderBy(property);
    };

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
            const keys = columns.filter(item => typeof item.searchable === "undefined" || item.searchable).map(item => item.searchable || item.sortable || item.id);
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
        return items;
    }, [search, data, order, orderBy, ...depends]);

    const tableColumns = (columns || []).map((item, idx) => {
        const { id, title, icon, dir, align, sortable, tags, columnProps = {}, labelProps = {} } = item;
        const sortId = typeof sortable === "string" ? sortable : id;
        const label = <Label icon={icon} name={title} />;
        const tagItems = (tags || []).filter(Boolean).map(tag => {
            return <Chip
                key={tag.id}
                color="primary"
                className={styles.tag}
                icon={tag.icon}
                label={tag.name}
                deleteIcon={
                    <Tooltip arrow title={translations.CLOSE}>
                        <CancelIcon />
                    </Tooltip>
                }
                onDelete={tag.onDelete} />;
        });
        return <TableCell
            key={id || idx}
            align={align}
            classes={{ root: clsx(styles.cell, !align && styles.defaultAlign, styles.head) }}
            dir={dir}
            padding="none"
            sortDirection={orderBy === sortId ? order : false}
            {...columnProps}>
            <div className={styles.headerRow}>
                {sortable && <TableSortLabel
                    className={styles.sortLabel}
                    active={orderBy === sortId}
                    direction={orderBy === sortId ? order : "desc"}
                    onClick={createSortHandler(sortId)}
                    {...labelProps}
                    dir={dir}
                >
                    {label}
                </TableSortLabel>}
                {!sortable && label}
                {!!tagItems.length && <div className={styles.tags}>
                    {tagItems}
                </div>}
            </div>
        </TableCell>;
    });

    const isEmpty = !items || !items.length;

    if (!size.height) {
        return null;
    }

    const height = size.height + "px";
    const style = {
        maxHeight: height
    };

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }
    const marginBottomInPixels = sizeToPixels(marginBottom);
    const rowHeightInPixels = sizeToPixels(rowHeight);
    const itemsPerPage = parseInt((size.height - marginBottomInPixels) / rowHeightInPixels);
    const pageCount = parseInt((items.length / itemsPerPage) + ((items.length % itemsPerPage) > 0 ? 1 : 0));
    const startIdx = offset;
    const endIdx = startIdx + itemsPerPage;
    const pageIndex = parseInt(startIdx / itemsPerPage);

    const setPageIndex = (index) => {
        setOffset(index * itemsPerPage);
    };

    const itemsOnPage = items.slice(startIdx, endIdx);

    const tableRows = itemsOnPage.map((item, idx) => {
        const { id } = item;
        return <Row key={id || idx} rowHeight={rowHeight} columns={columns} rowClick={rowClick} item={item} idx={idx} />;
    });

    return (<>
        <TableContainer className={className} style={style} {...props}>
            {!loading && <Table stickyHeader style={style}>
                {!hideColumns && <TableHead>
                    <TableRow>
                        {tableColumns}
                    </TableRow>
                </TableHead>}
                <TableBody>
                    {tableRows}
                </TableBody>
            </Table>}
            {!!isEmpty && empty}
            {!loading && <div className={styles.footer}>
                {statusBar}
                <Navigator pageIndex={pageIndex} setPageIndex={setPageIndex} pageCount={pageCount} />
            </div>}
        </TableContainer>
        {loading && <Progress />}
    </>);
}