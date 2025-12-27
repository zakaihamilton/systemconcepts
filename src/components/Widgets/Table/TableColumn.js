import clsx from "clsx";
import TableCell from "@mui/material/TableCell";
import TableSortLabel from "@mui/material/TableSortLabel";
import Label from "@widgets/Label";
import styles from "./TableColumn.module.scss";

export default function TableColumn({ item, order, orderBy, showSort, createSortHandler }) {
    const { id, title, icon, dir, align, sortable, columnProps = {}, labelProps = {} } = item;
    const sortId = typeof sortable === "string" ? sortable : id;
    const label = <Label icon={icon} name={title} />;
    return <TableCell
        align={align}
        classes={{ root: clsx(styles.cell, !align && styles.defaultAlign, styles.head) }}
        dir={dir}
        padding="none"
        sortDirection={orderBy === sortId ? order : false}
        {...columnProps}>
        <div className={styles.root}>
            {sortable && <TableSortLabel
                className={styles.sortLabel}
                active={showSort && orderBy === sortId}
                direction={orderBy === sortId ? order : "desc"}
                onClick={showSort ? createSortHandler(sortId) : undefined}
                {...labelProps}
                dir={dir}
            >
                {label}
            </TableSortLabel>}
            {!sortable && label}
        </div>
    </TableCell>;
}