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
import Head from "./Head";
import Bookmarks from "./Bookmarks";
import Header from "./Header";
import Footer from "./Footer";
import Title from "./Title";

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
    useLocalStorage("MainStore", MainStore);

    useEffect(() => {
        MainStore.update(s => {
            s.hash = window.location.hash;
        });
        window.onhashchange = function () {
            MainStore.update(s => {
                if (s.hash !== window.location.hash) {
                    s.hash = window.location.hash;
                }
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
        <Head />
        <Theme>
            <div className={className}>
                <Title />
                <Sync>
                    <Bookmarks />
                    <SideBar />
                    <div className={styles.main}>
                        <Header />
                        <Page />
                        <Footer />
                    </div>
                </Sync>
            </div>
        </Theme>
    </>;
}
