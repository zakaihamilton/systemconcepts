import React from "react";
import styles from "./AppBar/AppBar.module.scss"
import AppIcon from "./AppIcon";

export default function AppBar() {
    return <header className={styles.root}>
        <AppIcon />
    </header>;
}
