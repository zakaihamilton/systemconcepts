import { useRef, createContext } from "react";
import styles from "./Page.module.scss";
import { useResize } from "@util/size";
import { MainStore } from "@components/Main";
import Player from "@pages/Player";
import { useActivePages } from "@util/pages";

export const PageSize = createContext();

export default function Page() {
    const pages = useActivePages();
    const { hash, showSideBar } = MainStore.useState();
    const activePage = pages[pages.length - 1];
    const ref = useRef();
    const size = useResize(ref, [showSideBar, hash]);
    const playerPageRef = useRef(null);
    if (!activePage) {
        return null;
    }
    const { Component } = activePage;
    const showPage = activePage.id !== "player" && Component;
    const showPlayer = activePage.id === "player";
    if (showPlayer) {
        playerPageRef.current = { ...activePage };
    }
    return <>
        <PageSize.Provider value={size}>
            <div className={styles.pageContainer}>
                <main ref={ref} className={styles.page}>
                    {playerPageRef.current && <Player show={showPlayer} {...playerPageRef.current} />}
                    {process.browser && showPage && <Component {...activePage} />}
                </main>
            </div>
        </PageSize.Provider>
    </>;
}
