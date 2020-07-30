import React, { useEffect } from "react";
import Head from "next/head"
import AppBar from "./AppBar";
import StatusBar from "./StatusBar";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useStyles, useImportMedia } from "@/util/styles";
import { usePagesFromHash } from "@/util/pages";
import Breadcrumbs from "./Breadcrumbs";
import Page from "./Page";
import Theme from "./Theme";
import { useTranslations } from "@/util/translations";

export const MainStore = new Store({
    autoDetectDarkMode: true,
    darkMode: false,
    fontSize: "16",
    direction: "ltr",
    language: "eng",
    menuViewList: "List",
    showSideBar: true
});

export default function Main() {
    const { APP_NAME } = useTranslations();
    const isMobile = useImportMedia(im => im.lessThan('tablet'));
    useLocalStorage("MainStore", MainStore);
    const { direction, language, showSideBar, menuViewList, hash } = MainStore.useState();
    const pages = usePagesFromHash(hash);
    const activePage = pages[pages.length - 1];

    useEffect(() => {
        MainStore.update(s => {
            s.hash = window.location.hash;
        });
        window.onhashchange = function () {
            MainStore.update(s => {
                s.hash = window.location.hash;
            });
        };
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
        iconList: menuViewList === "IconList",
        rtl: direction === "rtl"
    });

    return <>
        <Head>
            <title>{APP_NAME}</title>
            <link rel="icon" href="/favicon.ico" />
        </Head>
        <Theme>
            <div className={className}>
                <AppBar />
                <SideBar />
                <div className={styles.main}>
                    <Breadcrumbs items={pages} />
                    <Page page={activePage} />
                </div>
                <StatusBar />
            </div>
        </Theme>
    </>;
}
