import styles from "./Item.module.scss";
import clsx from "clsx";
import { useStyles } from "@/util/styles";

export default function ItemWidget({ className, columns, rowClick, item, index, style, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, onSelectable, rowProps = {}, selected, onClick, style } = column;
        const value = item[columnId];
        return (<div
            dir={dir}
            style={style}
            onClick={onClick ? () => onClick(item) : undefined}
            className={clsx(styles.cell, onSelectable && onSelectable(item) && styles.selectable, selected && selected(item) && styles.selected)}
            key={columnId}
            {...rowProps}>
            {value}
        </div>);
    });
    const onClick = event => {
        rowClick(event, item);
    };
    const classes = useStyles(styles, {
        item: true,
        hover: !!rowClick
    });
    return <div className={classes + " " + className} style={style} {...rowClick && { onClick }} {...props}>
        {cells}
    </div>;
}
