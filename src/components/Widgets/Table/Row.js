import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import styles from "../Table.module.scss";
import clsx from "clsx";

export default function RowWidget({ rowHeight, columns, rowClick, item }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, onSelectable, rowProps = {}, onClick } = column;
        const value = item[columnId];
        return (<TableCell
            dir={dir}
            align={align}
            onClick={onClick ? () => onClick(item) : undefined}
            className={clsx(styles.cell, !align && styles.defaultAlign, onSelectable && onSelectable(item) && styles.selectable)}
            key={columnId}
            {...rowProps}>
            {value}
        </TableCell>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    return <TableRow style={{ minHeight: rowHeight, height: rowHeight, maxHeight: rowHeight }} {...rowClick && { hover: true, onClick, className: styles.rowHover }}>
        {cells}
    </TableRow>;
}
