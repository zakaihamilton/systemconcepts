import styles from "./Item.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";
import Tooltip from "@mui/material/Tooltip";

export default function ItemWidget({ className = "", viewMode, selected: selectedItem, columns, rowClick, item, index, style, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const {
            id: columnId, dir, align, padding = true, viewModes = {},
            onSelectable, ellipsis, selected, style,
            onClick, onMouseDown, onMouseUp, onMouseLeave,
            onTouchStart, onTouchEnd, onTouchCancel, onContextMenu
        } = column;
        const value = item[columnId];
        const { className: viewModeClassName = "", selectedClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        const isSelected = selected && selected(item);
        return (<div
            dir={dir}
            style={{ ...style, ...viewModeStyle }}
            onClick={onClick ? (e) => onClick(item, e) : undefined}
            onMouseDown={onMouseDown ? (e) => onMouseDown(item, e) : undefined}
            onMouseUp={onMouseUp ? (e) => onMouseUp(item, e) : undefined}
            onMouseLeave={onMouseLeave ? (e) => onMouseLeave(item, e) : undefined}
            onTouchStart={onTouchStart ? (e) => onTouchStart(item, e) : undefined}
            onTouchEnd={onTouchEnd ? (e) => onTouchEnd(item, e) : undefined}
            onTouchCancel={onTouchCancel ? (e) => onTouchCancel(item, e) : undefined}
            onContextMenu={onContextMenu ? (e) => onContextMenu(item, e) : undefined}
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
        hover: !!rowClick,
        selected: selectedItem,
        even: index % 2 === 0
    });
    return <div className={styles.root} style={style}>
        <div className={classes + " " + className} {...rowClick && { onClick }} {...props}>
            {cells}
        </div>
    </div>;
}
