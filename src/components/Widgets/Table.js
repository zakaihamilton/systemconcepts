import React, { useContext, useEffect } from "react";
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
import { MainStore } from "../Main";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import ImportExportIcon from '@material-ui/icons/ImportExport';
import { exportData } from "@/util/importExport";
import Row from "./Table/Row";
import Navigator from "./Table/Navigator";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export default function TableWidget({ name, rowHeight = "3em", columns, sortColumn, data, mapper, empty, className, hideColumns, rowClick, ...props }) {
    const translations = useTranslations();
    const [order, setOrder] = React.useState("desc");
    const [offset, setOffset] = React.useState(0);
    columns = columns || [];
    const [orderBy, setOrderBy] = React.useState(sortColumn || (columns[0] && columns[0].id) || 0);
    const size = useContext(PageSize);
    const { search } = MainStore.useState();
    const hasIdColumn = columns.find(item => item.id === "id");

    useEffect(() => {
        setOffset(0);
    }, [data]);

    let items = data || [];
    if (mapper) {
        items = items.map(mapper);
    }

    items = items.filter(item => {
        if (!search) {
            return true;
        }
        for (const key in item) {
            if (key === "id" && !hasIdColumn) {
                continue;
            }
            if (typeof item[key] === "string") {
                const match = item[key].toLowerCase().includes(search.toLowerCase());
                if (match) {
                    return true;
                }
            }
        }
        return false;
    });

    const createSortHandler = (property) => () => {
        const isDesc = orderBy === property && order === "desc";
        setOrder(isDesc ? "asc" : "desc");
        setOrderBy(property);
    };

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

    const tableColumns = (columns || []).map(item => {
        const { id, title, dir, align, sortable, columnProps = {}, labelProps = {} } = item;
        const sortId = typeof sortable === "string" ? sortable : id;
        return <TableCell
            key={id}
            align={align}
            className={clsx(styles.cell, !align && styles.defaultAlign, styles.head)}
            dir={dir}
            sortDirection={orderBy === sortId ? order : false}
            {...columnProps}>
            {sortable && <TableSortLabel
                className={styles.sortLabel}
                active={orderBy === sortId}
                direction={orderBy === sortId ? order : "desc"}
                onClick={createSortHandler(sortId)}
                {...labelProps}
                dir={dir}
            >
                {title}
            </TableSortLabel>}
            {!sortable && title}
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

    const rowHeightNum = parseFloat(rowHeight);
    const rowHeightInPixels = rowHeight.trim().endsWith("em") ? rowHeightNum * size.emPixels : rowHeightNum;
    const itemsPerPage = parseInt(size.height / rowHeightInPixels) - 1;
    const pageCount = parseInt((items.length / itemsPerPage) + 1);
    const startIdx = offset;
    const endIdx = startIdx + itemsPerPage;
    const pageIndex = parseInt(startIdx / itemsPerPage);

    const setPageIndex = (index) => {
        setOffset(index * itemsPerPage);
    };

    const itemsOnPage = items.slice(startIdx, endIdx);

    const tableRows = stableSort(itemsOnPage || [], getComparator(order, orderBy)).map((item, idx) => {
        const { id } = item;
        return <Row key={id || idx} rowHeight={rowHeight} columns={columns} rowClick={rowClick} item={item} idx={idx} />;
    });

    const menuItems = [
        data && name && {
            id: "export",
            name: translations.EXPORT,
            icon: <ImportExportIcon />,
            onClick: () => {
                const body = JSON.stringify({ [name]: data }, null, 4);
                exportData(body, name, "application/json");
            }
        }
    ].filter(Boolean);

    return (<TableContainer className={className} style={style} {...props}>
        {!!menuItems.length && <Menu items={menuItems}>
            <IconButton className={styles.menuButton}>
                <MoreVertIcon />
            </IconButton>
        </Menu>}
        <Table stickyHeader style={style}>
            {!hideColumns && <TableHead>
                <TableRow>
                    {tableColumns}
                </TableRow>
            </TableHead>}
            <TableBody>
                {tableRows}
            </TableBody>
        </Table>
        {!!isEmpty && empty}
        <Navigator pageIndex={pageIndex} setPageIndex={setPageIndex} pageCount={pageCount} />
    </TableContainer>);
}