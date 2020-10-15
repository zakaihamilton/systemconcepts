import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import styles from "./Row.module.scss";
import clsx from "clsx";
import { useStyles } from "@/util/styles";

export default function RowWidget({ className = "", viewMode, rowHeight, columns, rowClick, item, style = {}, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, viewModes = {}, onSelectable, onClick, selected } = column;
        const { className: viewModeClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
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
                    selected && selected(item) && styles.selected,
                    viewModeClassName
                )
            }}
            style={viewModeStyle}
            key={columnId}
            {...viewModeProps}
        >
            {value}
        </TableCell>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    const classes = useStyles(styles, {
        row: true,
        hover: !!rowClick
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
