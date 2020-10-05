import { useRef, createContext } from "react";
import styles from "./Page.module.scss";
import { useResize } from "@/util/size";
import { MainStore } from "@/components/Main";
import { usePagesFromHash } from "@/util/pages";
import Breadcrumbs from "./Breadcrumbs";
import Player from "@/pages/Player";

export const PageSize = createContext();

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
    const showPage = activePage.id !== "player" && Component;
    const showPlayer = activePage.id === "player";
    return <>
        <Breadcrumbs items={pages} />
        <div className={styles.pageContainer}>
            <main ref={ref} className={styles.page}>
                <PageSize.Provider value={size}>
                    <Player show={showPlayer} {...showPlayer && activePage} />
                    {showPage && <Component {...activePage} />}
                </PageSize.Provider>
            </main>
        </div>
    </>;
}
