import React from 'react';
import Fab from '@material-ui/core/Fab';
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./Fab.module.scss";
import clsx from "clsx";

export default function FloatingActionButtons({ onClick, title, icon, ...props }) {
    const className = clsx(styles.root, onClick && styles.visible);

    return (
        <Tooltip arrow title={title}>
            <Fab className={className} color="primary" onClick={onClick} {...props}>
                {icon}
            </Fab>
        </Tooltip>
    );
}
