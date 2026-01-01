import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import styles from "./Row.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";

export default function Row({ className = "", separator, viewMode, index, selected: selectedRow, rowHeight, columns, rowClick, item, style = {}, renderColumn, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, padding = true, viewModes = {}, onSelectable, onClick, selected } = column;
        const { className: viewModeClassName = "", selectedClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        const value = renderColumn ? renderColumn(columnId, item) : item[columnId];
        const isSelected = selected && selected(item);
        return (<TableCell
            dir={dir}
            align={align}
            onClick={onClick ? () => onClick(item) : undefined}
            padding="none"
            classes={{
                root: clsx(styles.cell, separator && styles.separator)
            }}
            style={{ height: rowHeight, ...viewModeStyle }}
            key={columnId}
            {...viewModeProps}
        >
            <div className={clsx(
                styles.cellContent,
                padding && styles.padding,
                !align && styles.defaultAlign,
                onSelectable && onSelectable(item) && styles.selectable,
                isSelected && styles.selected,
                isSelected && selectedClassName,
                viewModeClassName
            )}
            >
                {value}
            </div>
        </TableCell>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    const classes = useStyles(styles, {
        root: true,
        separator,
        hover: !!rowClick,
        selected: selectedRow,
        even: index % 2 === 0
    });
    return <TableRow
        className={classes + " " + className}
        style={{ minHeight: rowHeight, height: rowHeight, maxHeight: rowHeight, ...style }}
        {...rowClick && { hover: true, onClick }}
        {...props}
    >
        {cells}
    </TableRow>;
}
