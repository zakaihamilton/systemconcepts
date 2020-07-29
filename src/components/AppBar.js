import React from "react";
import styles from "./AppBar.module.scss"
import MenuIcon from "./AppBar/MenuIcon";
import AppTitle from "./AppBar/AppTitle";

export default function AppBar() {
    return <header className={styles.root}>
        <MenuIcon />
        <AppTitle />
    </header>;
}
