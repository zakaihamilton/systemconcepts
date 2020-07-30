import React from "react";
import styles from "./Button.module.scss";

export default function ButtonWidget({ children, ...props }) {
    return <button className={styles.root} {...props}>
        {children}
    </button>;
}
