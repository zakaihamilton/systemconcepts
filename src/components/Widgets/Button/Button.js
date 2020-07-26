import React from "react";
import clsx from "clsx";
import styles from "./StatusBar.module.scss";

export default function ButtonWidget({ children, ...props }) {
    return <button className={styles.root} {...props}>
        {children}
    </button>;
}
