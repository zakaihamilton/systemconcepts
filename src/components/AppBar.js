import React from "react";
import styles from "./AppBar/AppBar.module.scss"
import AppIcon from "./AppBar/AppIcon";
import AppTitle from "./AppBar/AppTitle";

export default function AppBar() {
    return <header className={styles.root}>
        <AppIcon />
        <AppTitle />
    </header>;
}
