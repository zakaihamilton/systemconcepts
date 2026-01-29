import styles from "./ListColumns.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";
import Tooltip from "@mui/material/Tooltip";
import Label from "@widgets/Label";
import TableSortLabel from "@mui/material/TableSortLabel";

export default function ListColumns({ className = "", viewMode, columns, index, style, order, orderBy, onSort, showSort, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, viewModes = {}, icon, title, ellipsis, sortable, style } = column;
        const sortId = typeof sortable === "string" ? sortable : columnId;
        const { className: viewModeClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
        const label = <Label icon={icon} name={title} />;
        return (<div
            dir={dir}
            style={{ ...style, ...viewModeStyle }}
            className={clsx(
                styles.cell,
                ellipsis && styles.ellipsis,
                !align && styles.defaultAlign,
                viewModeClassName,
                styles[viewMode]
            )}
            key={columnId}
            {...viewModeProps}
        >
            <Tooltip arrow title={title}>
                <span>
                    {sortable ? (
                        <TableSortLabel
                            active={showSort && orderBy === sortId}
                            direction={orderBy === sortId ? order : "desc"}
                            onClick={showSort ? onSort(sortId) : undefined}
                        >
                            {label}
                        </TableSortLabel>
                    ) : label}
                </span>
            </Tooltip>
        </div>);
    });
    const classes = useStyles(styles, {
        item: true,
        even: index % 2 === 0
    });
    return <div className={styles.root} style={style}>
        <div className={classes + " " + className} {...props}>
            {cells}
        </div>
    </div>;
}
