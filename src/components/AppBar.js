import React from "react";
import styles from "./AppBar.module.scss"
import MenuIcon from "./AppBar/MenuIcon";
import AppTitle from "./AppBar/AppTitle";
import Settings from "./AppBar/Settings";
import Search from "./AppBar/Search";

export default function AppBar() {
    return <header className={styles.root}>
        <MenuIcon />
        <AppTitle />
        <div style={{ flex: 1 }} />
        <Settings />
        <Search />
    </header>;
}
