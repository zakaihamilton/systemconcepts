import React, { useEffect, useState } from "react";
import styles from "./AppBar.module.scss"
import IconButton from "@/widgets/IconButton/IconButton";
import AppsIcon from '@material-ui/icons/Apps';
import { getSlot } from "@/util/slots";

export default function AppBar() {
    const mainSlot = getSlot("main");

    const toggleMenu = () => {
        mainSlot.showMenu = !mainSlot.showMenu;
        mainSlot.update();
    };

    return <header className={styles.root}>
        <IconButton onClick={toggleMenu}>
            <AppsIcon />
        </IconButton>
    </header>;
}
