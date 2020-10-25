import clsx from "clsx";
import TableCell from "@material-ui/core/TableCell";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import Label from "@widgets/Label";
import styles from "./Column.module.scss";

export default function TableColumn({ item, order, orderBy, createSortHandler }) {
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
        <div className={styles.headerRow}>
            {sortable && <TableSortLabel
                className={styles.sortLabel}
                active={orderBy === sortId}
                direction={orderBy === sortId ? order : "desc"}
                onClick={createSortHandler(sortId)}
                {...labelProps}
                dir={dir}
            >
                {label}
            </TableSortLabel>}
            {!sortable && label}
        </div>
    </TableCell>;
}