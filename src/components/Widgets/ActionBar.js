import React from "react";
import styles from "./ActionBar.module.scss";

export default function ActionBarWidget({ children, ...props }) {
    return <>
        <div style={{ flex: 1 }} />
        <div className={styles.root} {...props}>
            {children}
        </div>
    </>;
}
