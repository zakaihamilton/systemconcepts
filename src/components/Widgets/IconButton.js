import React from "react";
import clsx from "clsx";
import styles from "./IconButton/IconButton.module.scss";
import IconButton from '@material-ui/core/IconButton';

export default function IconButtonWidget({ children, ...props }) {
    return <IconButton className={styles.root} {...props}>
        {children}
    </IconButton>;
}
