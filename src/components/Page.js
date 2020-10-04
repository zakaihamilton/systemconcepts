import React, { useRef } from "react";
import styles from "./Page.module.scss";
import { useResize } from "@/util/size";
import { MainStore } from "@/components/Main";
import { usePagesFromHash } from "@/util/pages";
import Breadcrumbs from "./Breadcrumbs";

export const PageSize = React.createContext();

export default function Page() {
    const { hash, fullscreen, showSideBar } = MainStore.useState();
    const pages = usePagesFromHash(hash);
    const activePage = pages[pages.length - 1];
    const ref = useRef();
    const size = useResize(ref, [fullscreen, showSideBar]);
    if (!activePage) {
        return null;
    }
    const { Component } = activePage;
    return <>
        <Breadcrumbs items={pages} />
        <div className={styles.pageContainer}>
            <main ref={ref} className={styles.page}>
                <PageSize.Provider value={size}>
                    {Component && <Component {...activePage} />}
                </PageSize.Provider>
            </main>
        </div>
    </>;
}
