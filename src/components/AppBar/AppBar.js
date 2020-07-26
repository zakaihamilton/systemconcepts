import React from "react";
import styles from "./AppBar.module.scss"
import AppIcon from "./AppIcon/AppIcon";

export default function AppBar() {
    return <header className={styles.root}>
        <AppIcon />
    </header>;
}
