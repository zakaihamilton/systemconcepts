import { memo } from "react";
import styles from "./Item.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";
import Tooltip from "@mui/material/Tooltip";

// Performance optimization: Custom comparator to handle 'style' prop stability.
// The 'style' prop from react-window often changes reference but contains the same values.
// This prevents unnecessary re-renders of table cells when selection changes or during non-layout updates.
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

function ItemWidget({ className = "", separator, viewMode, selected: selectedItem, columns, rowClick, item, index, style, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, padding = true, viewModes = {}, onSelectable, ellipsis, selected, onClick, style } = column;
        const value = item[columnId];
        const { className: viewModeClassName = "", selectedClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        const isSelected = selected && selected(item);
        return (<div
            dir={dir}
            style={{ ...style, ...viewModeStyle }}
            onClick={onClick ? () => onClick(item) : undefined}
            className={clsx(
                styles.cell,
                padding && styles.padding,
                onSelectable && onSelectable(item) && styles.selectable,
                isSelected && styles.selected,
                isSelected && selectedClassName,
                ellipsis && styles.ellipsis,
                !align && styles.defaultAlign,
                viewModeClassName,
                styles[viewMode]
            )}
            key={columnId}
            {...viewModeProps}
        >
            {!!ellipsis && <Tooltip arrow title={item[ellipsis]}>
                <div className={styles.ellipsisText}>{value}</div>
            </Tooltip>}
            {!ellipsis && value}
        </div>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    const classes = useStyles(styles, {
        item: true,
        separator,
        hover: !!rowClick,
        selected: selectedItem,
        even: index % 2 === 0
    });
    return <div className={styles.root} style={{ ...style, '--group-color': item.color }}>
        <div className={classes + " " + className} {...rowClick && { onClick }} {...props}>
            {cells}
        </div>
    </div>;
}

export default memo(ItemWidget, arePropsEqual);
