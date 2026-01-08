import { memo } from "react";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import styles from "./Row.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";

// Performance optimization: Custom comparator to handle 'style' prop stability.
// The 'style' prop from parent (or viewModes) often changes reference but contains the same values.
// This prevents unnecessary re-renders of table rows when parent renders but row data is unchanged.
function arePropsEqual(prev, next) {
    if (prev === next) return true;
    const keysA = Object.keys(prev);
    const keysB = Object.keys(next);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (key === "style") {
            const styleA = prev.style || {};
            const styleB = next.style || {};
            if (styleA === styleB) continue;
            const sKeysA = Object.keys(styleA);
            const sKeysB = Object.keys(styleB);
            if (sKeysA.length !== sKeysB.length) return false;
            for (const sKey of sKeysA) {
                if (styleA[sKey] !== styleB[sKey]) return false;
            }
        } else {
            if (prev[key] !== next[key]) return false;
        }
    }
    return true;
}

function RowWidget({ className = "", separator, viewMode, index, selected: selectedRow, rowHeight, columns, rowClick, item, style = {}, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, padding = true, viewModes = {}, onSelectable, onClick, selected } = column;
        const { className: viewModeClassName = "", selectedClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        const value = item[columnId];
        const isSelected = selected && selected(item);
        return (<TableCell
            dir={dir}
            align={align}
            onClick={onClick ? () => onClick(item) : undefined}
            padding="none"
            classes={{
                root: clsx(
                    styles.cell,
                    padding && styles.padding,
                    !align && styles.defaultAlign,
                    onSelectable && onSelectable(item) && styles.selectable,
                    isSelected && styles.selected,
                    isSelected && selectedClassName,
                    viewModeClassName,
                    separator && styles.separator
                )
            }}
            style={{ height: rowHeight, ...viewModeStyle }}
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

export default memo(RowWidget, arePropsEqual);
