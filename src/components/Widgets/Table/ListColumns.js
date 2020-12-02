import styles from "./ListColumns.module.scss";
import clsx from "clsx";
import { useStyles } from "@util/styles";
import Tooltip from '@material-ui/core/Tooltip';

export default function ListColumns({ className = "", viewMode, columns, index, style, ...props }) {
    const cells = (columns || []).filter(Boolean).map(column => {
        const { id: columnId, dir, align, viewModes = {}, title, ellipsis, style } = column;
        const { className: viewModeClassName = "", style: viewModeStyle = {}, ...viewModeProps } = viewModes[viewMode] || {};
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
                <div className={styles.ellipsisText}>{title}</div>
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
