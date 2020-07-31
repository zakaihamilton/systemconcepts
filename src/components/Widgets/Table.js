import React, { useContext } from "react";
import clsx from "clsx";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import { PageSize } from "../Page";
import { useDeviceType } from "@/util/styles";
import styles from "./Table.module.scss";
import { MainStore } from "../Main";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export default function TableWidget({ columns, sortColumn, items = [], empty, className, hideColumns, rowClick, ...props }) {
    const isMobile = useDeviceType() === "phone";
    const [order, setOrder] = React.useState("desc");
    columns = columns || [];
    const [orderBy, setOrderBy] = React.useState(sortColumn || (columns[0] && columns[0].id) || 0);
    const size = useContext(PageSize);
    const { search } = MainStore.useState();
    const hasIdColumn = columns.find(item => item.id === "id");

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
        const { id, title, dir, sortable, columnProps = {}, labelProps = {} } = item;
        const sortId = typeof sortable === "string" ? sortable : id;
        return <TableCell
            key={id}
            className={clsx(styles.cell, styles.head)}
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

    const tableRows = stableSort(items || [], getComparator(order, orderBy)).map((row, idx) => {
        const { id } = row;
        const cells = (columns || []).filter(Boolean).map(column => {
            const { id: columnId, dir, rowProps = {} } = column;
            const value = row[columnId];
            return (<TableCell dir={dir} className={styles.cell} key={columnId} {...rowProps}>{value}</TableCell>);
        });
        const onClick = rowClick ? event => rowClick(event, id || idx) : null;
        return <TableRow {...onClick && { hover: true, onClick, className: styles.rowHover }} key={id || idx}>
            {cells}
        </TableRow>;
    });

    if (!size.height) {
        return null;
    }

    const height = size.height + "px";
    const style = {
        maxHeight: height
    };

    return (<TableContainer className={className} style={style} {...props}>
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
    </TableContainer>);
}