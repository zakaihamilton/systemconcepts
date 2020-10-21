import React, { useEffect } from "react";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useStyles, useDeviceType } from "@/util/styles";
import Page from "./Page";
import Theme from "./Theme";
import { useLanguage } from "@/util/language";
import Sync from "./Sync";
import Header from "./Header";
import Bookmarks from "./Bookmarks";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useActivePages } from "@/util/pages";

export const MainStoreDefaults = {
    autoDetectDarkMode: true,
    darkMode: false,
    fontSize: "16",
    direction: "ltr",
    language: "auto",
    menuViewList: "List",
    showSideBar: true,
    showDrawer: false
};

export const MainStore = new Store(MainStoreDefaults);

export default function Main() {
    const language = useLanguage();
    const isMobile = useDeviceType() !== "desktop";
    const { direction, showSideBar, menuViewList } = MainStore.useState();
    const pages = useActivePages();
    useLocalStorage("MainStore", MainStore);

    useEffect(() => {
        MainStore.update(s => {
            s.hash = window.location.hash;
        });
        window.onhashchange = function () {
            MainStore.update(s => {
                s.hash = window.location.hash;
            });
        };
        return () => {
            window.onhashchange = null;
        }
    }, []);

    useEffect(() => {
        MainStore.update(s => {
            s.direction = language === "heb" ? "rtl" : "ltr";
            document.getElementsByTagName('html')[0].setAttribute("dir", s.direction);
        });
    }, [language]);

    const className = useStyles(styles, {
        root: true,
        sidebar: showSideBar && !isMobile,
        list: menuViewList === "List",
        rtl: direction === "rtl"
    });

    return <>
        <Header />
        <Theme>
            <div className={className}>
                <Breadcrumbs className={styles.bar} items={pages} bar={true} />
                <Sync />
                <Bookmarks />
                <SideBar />
                <div className={styles.main}>
                    <Page pages={pages} />
                </div>
            </div>
        </Theme>
    </>;
}
