import { useRef, createContext, useState, useEffect } from "react";
import styles from "./Content.module.scss";
import { useSize } from "@util/size";
import { MainStore } from "@components/Main";
import { useActivePages, useParentParams } from "@util/pages";
import pages from "@data/pages";

export const ContentSize = createContext();

export default function Content() {
    const activePages = useActivePages();
    const parentParams = useParentParams();
    const { hash, showSideBar } = MainStore.useState();
    const activePage = activePages[activePages.length - 1];
    const ref = useRef();
    const size = useSize(ref, [showSideBar, hash]);
    const [playerPage, setPlayerPage] = useState(null);
    const showPlayer = activePage?.id === "player";
    useEffect(() => {
        if (!activePage) {
            return;
        }
        const timerHandle = setTimeout(() => {
            if (showPlayer) {
                setPlayerPage(prev => {
                    const newPage = { ...activePage, ...parentParams };
                    if (prev && prev.id === newPage.id && prev.url === newPage.url && prev.group === newPage.group && prev.name === newPage.name) {
                        return prev;
                    }
                    return newPage;
                });
            }
        }, 0);
        return () => clearTimeout(timerHandle);
    }, [showPlayer, activePage, parentParams]);
    if (!activePage) {
        return null;
    }
    const { Component } = activePage;
    const showPage = activePage.id !== "player" && Component;
    const Player = pages.find(page => page.id === "player").Component;
    return <ContentSize.Provider value={size}>
        <div className={styles.root}>
            <div ref={ref} className={styles.pageContainer}>
                <main className={styles.page}>
                    {playerPage && <Player key={playerPage.url} show={showPlayer} {...playerPage} />}
                    {showPage && <Component {...activePage} />}
                </main>
            </div>
        </div>
    </ContentSize.Provider>;
}
