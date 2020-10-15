import styles from "./Item.module.scss";
import clsx from "clsx";
import { useStyles } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';

export default function ItemWidget({ className, viewMode, columns, rowClick, item, index, style, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, viewModes = {}, onSelectable, ellipsis, selected, onClick, style } = column;
        const value = item[columnId];
        const { className: viewModeClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        return (<div
            dir={dir}
            style={{ ...style, ...viewModeStyle }}
            onClick={onClick ? () => onClick(item) : undefined}
            className={clsx(
                styles.cell,
                onSelectable && onSelectable(item) && styles.selectable,
                selected && selected(item) && styles.selected,
                ellipsis && styles.ellipsis,
                !align && styles.defaultAlign,
                viewModeClassName
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
        hover: !!rowClick
    });
    return <div className={styles.root} style={style}>
        <div className={classes + " " + className} {...rowClick && { onClick }} {...props}>
            {cells}
        </div>
    </div>;
}
