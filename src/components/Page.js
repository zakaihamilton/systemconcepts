import React, { useRef } from "react";
import styles from "./Page.module.scss";
import { useResize } from "@/util/size";

export const PageSize = React.createContext();

export default function Page({ page }) {
    const ref = useRef();
    const size = useResize(ref);
    const { Component } = page;
    return <div className={styles.pageContainer}>
        <main ref={ref} className={styles.page}>
            <PageSize.Provider value={size}>
                {Component && <Component {...page} />}
            </PageSize.Provider>
        </main>
    </div>;
}
