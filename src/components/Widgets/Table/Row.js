import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import styles from "./Row.module.scss";
import clsx from "clsx";
import { useStyles } from "@/util/styles";

export default function RowWidget({ rowHeight, columns, rowClick, item }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, onSelectable, rowProps = {}, onClick, selected } = column;
        const value = item[columnId];
        return (<TableCell
            dir={dir}
            align={align}
            onClick={onClick ? () => onClick(item) : undefined}
            padding="none"
            classes={{
                root: clsx(
                    styles.cell,
                    !align && styles.defaultAlign,
                    onSelectable && onSelectable(item) && styles.selectable,
                    selected && selected(item) && styles.selected)
            }}
            key={columnId}
            {...rowProps}>
            {value}
        </TableCell>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    const className = useStyles(styles, {
        row: true,
        hover: !!rowClick
    });
    return <TableRow className={className} style={{ minHeight: rowHeight, height: rowHeight, maxHeight: rowHeight }} {...rowClick && { hover: true, onClick }}>
        {cells}
    </TableRow>;
}
