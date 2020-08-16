import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import styles from "../Table.module.scss";
import clsx from "clsx";

export default function RowWidget({ rowHeight, columns, rowClick, item }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, rowProps = {} } = column;
        const value = item[columnId];
        return (<TableCell
            dir={dir}
            align={align}
            className={clsx(styles.cell, !align && styles.defaultAlign)}
            key={columnId}
            {...rowProps}>
            {value}
        </TableCell>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    return <TableRow style={{ height: rowHeight }} {...rowClick && { hover: true, onClick, className: styles.rowHover }}>
        {cells}
    </TableRow>;
}
