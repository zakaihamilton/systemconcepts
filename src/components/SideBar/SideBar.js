import React from "react";
import styles from "./SideBar.module.scss"
import { getSlot } from "@/util/slots";

export default function SideBar() {
    const mainSlot = getSlot("main");

    return <div className={styles.root}>
        {mainSlot.menu}
    </div>;
}
