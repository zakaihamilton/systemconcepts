import { useRef, createContext } from "react";
import styles from "./Page.module.scss";
import { useResize } from "@/util/size";
import { MainStore } from "@/components/Main";
import { useActivePages } from "@/util/pages";
import Breadcrumbs from "@/components/Breadcrumbs";
import Player from "@/pages/Player";
import Footer from "./Footer";

export const PageSize = createContext();

export default function Page() {
    const { hash, fullscreen, showSideBar } = MainStore.useState();
    const pages = useActivePages();
    const activePage = pages[pages.length - 1];
    const ref = useRef();
    const size = useResize(ref, [fullscreen, showSideBar, hash]);
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
            <Breadcrumbs items={pages} border={true} menu={true} />
            <div className={styles.pageContainer}>
                <main ref={ref} className={styles.page}>
                    {playerPageRef.current && <Player show={showPlayer} {...playerPageRef.current} />}
                    {showPage && <Component {...activePage} />}
                </main>
            </div>
            <Footer />
        </PageSize.Provider>
    </>;
}
