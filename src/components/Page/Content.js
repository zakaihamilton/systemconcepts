import { useRef, createContext } from "react";
import styles from "./Content.module.scss";
import { useSize } from "@util/size";
import { MainStore } from "@components/Main";
import { useActivePages } from "@util/pages";
import pages from "@data/pages";

export const ContentSize = createContext();

export default function Content() {
    const activePages = useActivePages();
    const { hash, showSideBar } = MainStore.useState();
    const activePage = activePages[activePages.length - 1];
    const ref = useRef();
    const size = useSize(ref, [showSideBar, hash]);
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
    const Player = pages.find(page => page.id === "player").Component;
    return <ContentSize.Provider value={size}>
        <div className={styles.pageContainer}>
            <main ref={ref} className={styles.page}>
                {playerPageRef.current && <Player show={showPlayer} {...playerPageRef.current} />}
                {showPage && <Component {...activePage} />}
            </main>
        </div>
    </ContentSize.Provider>;
}
