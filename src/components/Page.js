import React, { useRef } from "react";
import styles from "./Page/Page.module.scss";
import { useResize } from "@/util/size";

export const PageSize = React.createContext();

export default function Page({ page }) {
    const ref = useRef();
    const size = useResize(ref);
    const { Component } = page;
    return <div className={styles.pageContainer}>
        <main ref={ref} className={styles.page}>
            <PageSize.Provider value={size}>
                {Component && <Component />}
            </PageSize.Provider>
        </main>
    </div>;
}
