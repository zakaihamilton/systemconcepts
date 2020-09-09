import React, { useEffect } from "react";
import Head from "next/head"
import AppBar from "./AppBar";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useStyles, useDeviceType } from "@/util/styles";
import { usePagesFromHash } from "@/util/pages";
import Breadcrumbs from "./Breadcrumbs";
import Page from "./Page";
import Theme from "./Theme";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import { useSync } from "@/storage/sync";

export const MainStoreDefaults = {
    autoDetectDarkMode: true,
    darkMode: false,
    fontSize: "16",
    direction: "ltr",
    language: "auto",
    menuViewList: "List",
    showSideBar: true,
    showDrawer: false,
    fullscreen: false
};

export const MainStore = new Store(MainStoreDefaults);

export default function Main() {
    const { APP_NAME } = useTranslations();
    const language = useLanguage();
    const isPhone = useDeviceType() === "phone";
    useLocalStorage("MainStore", MainStore);
    const { direction, showSideBar, menuViewList, hash, fullscreen } = MainStore.useState();
    const pages = usePagesFromHash(hash);
    useSync();
    const activePage = pages[pages.length - 1];

    useEffect(() => {
        MainStore.update(s => {
            s.hash = window.location.hash;
        });
        window.onhashchange = function () {
            setTimeout(() => {
                MainStore.update(s => {
                    s.hash = window.location.hash;
                });
            }, 0);
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
        sidebar: showSideBar && !isPhone && !fullscreen,
        list: menuViewList === "List",
        rtl: direction === "rtl",
        fullscreen
    });

    return <>
        <Head>
            <title>{APP_NAME}</title>
            <link rel="icon" href="/favicon.ico" />
        </Head>
        <Theme>
            <div className={className}>
                {!fullscreen && <AppBar />}
                <SideBar />
                <div className={styles.main}>
                    <Breadcrumbs items={pages} />
                    <Page page={activePage} />
                </div>
            </div>
        </Theme>
    </>;
}
