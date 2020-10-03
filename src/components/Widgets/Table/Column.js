import { useTranslations } from "@/util/translations";
import clsx from "clsx";
import TableCell from "@material-ui/core/TableCell";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import Label from "@/widgets/Label";
import Chip from '@material-ui/core/Chip';
import CancelIcon from '@material-ui/icons/Cancel';
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./Column.module.scss";

export default function TableColumn({ item, order, orderBy, createSortHandler }) {
    const { id, title, icon, dir, align, sortable, tags, columnProps = {}, labelProps = {} } = item;
    const translations = useTranslations();
    const sortId = typeof sortable === "string" ? sortable : id;
    const label = <Label icon={icon} name={title} />;
    const tagItems = (tags || []).filter(Boolean).map(tag => {
        return <Chip
            key={tag.id}
            color="primary"
            className={styles.tag}
            icon={tag.icon}
            label={tag.name}
            deleteIcon={
                <Tooltip arrow title={translations.CLOSE}>
                    <CancelIcon />
                </Tooltip>
            }
            onDelete={tag.onDelete} />;
    });
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
            {!!tagItems.length && <div className={styles.tags}>
                {tagItems}
            </div>}
        </div>
    </TableCell>;
}