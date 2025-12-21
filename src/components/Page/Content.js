import { useRef, createContext, useState, useEffect } from "react";
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
    const [playerPage, setPlayerPage] = useState(null);
    const showPlayer = activePage?.id === "player";
    const showTranscript = activePage?.id === "transcript";
    useEffect(() => {
        if (!activePage) {
            return;
        }
        const timerHandle = setTimeout(() => {
            if (showPlayer && !showTranscript) {
                setPlayerPage(prev => {
                    if (prev && prev.id === activePage.id && prev.url === activePage.url) {
                        return prev;
                    }
                    return { ...activePage };
                });
            }
            else if (showTranscript) {
                setPlayerPage(prev => {
                    if (prev && prev.url === activePage.url) {
                        return prev;
                    }
                    return { ...activePage, suffix: ".m4a" };
                });
            }
        }, 0);
        return () => clearTimeout(timerHandle);
    }, [showPlayer, showTranscript, activePage]);
    if (!activePage) {
        return null;
    }
    const { Component } = activePage;
    const showPage = activePage.id !== "player" && Component;
    const Player = pages.find(page => page.id === "player").Component;
    return <ContentSize.Provider value={size}>
        <div ref={ref} className={styles.pageContainer}>
            <main className={styles.page}>
                {playerPage && <Player key={playerPage.url} show={showPlayer} {...playerPage} />}
                {showPage && <Component {...activePage} />}
            </main>
        </div>
    </ContentSize.Provider>;
}
