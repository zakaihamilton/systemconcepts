import { useRef, createContext } from "react";
import styles from "./Page.module.scss";
import { useSize } from "@util/size";
import { MainStore } from "@components/Main";
import { useActivePages } from "@util/pages";
import NoSsr from '@material-ui/core/NoSsr';
import pages from "@data/pages";

export const PageSize = createContext();

export default function Page() {
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
    return <>
        <PageSize.Provider value={size}>
            <div className={styles.pageContainer}>
                <main ref={ref} className={styles.page}>
                    {playerPageRef.current && <Player show={showPlayer} {...playerPageRef.current} />}
                    <NoSsr>
                        {showPage && <Component {...activePage} />}
                    </NoSsr>
                </main>
            </div>
        </PageSize.Provider>
    </>;
}
