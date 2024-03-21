import React, { useEffect } from "react";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useLocalStorage } from "@util/store";
import { useStyles, useDeviceType } from "@util/styles";
import Page from "./Page";
import Theme from "./Theme";
import { useLanguage } from "@util/language";
import Sync from "./Sync";
import Head from "./Head";
import Bookmarks from "./Bookmarks";
import Title from "./Title";
import { useResize } from "@util/size";
import clsx from "clsx";
import CssBaseline from "@mui/material/CssBaseline";
import NoSsr from "@mui/material/NoSsr";

export const MainStoreDefaults = {
    fontSize: "16",
    direction: "ltr",
    language: "auto",
    showSideBar: true,
    showDrawer: false
};

export const MainStore = new Store(MainStoreDefaults);

export default function Main() {
    const counter = useResize();
    const language = useLanguage();
    const isMobile = useDeviceType() !== "desktop";
    const { direction, showSideBar } = MainStore.useState();
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
        };
    }, []);

    useEffect(() => {
        MainStore.update(s => {
            s.direction = language === "heb" ? "rtl" : "ltr";
            document.getElementsByTagName("html")[0].setAttribute("dir", s.direction);
        });
    }, [language]);

    const className = useStyles(styles, {
        root: true,
        sidebar: showSideBar && !isMobile,
        mobile: isMobile,
        rtl: direction === "rtl"
    });

    return <>
        <Head />
        <Theme>
            <CssBaseline />
            <div className={className}>
                <Title />
                <Sync>
                    <Bookmarks />
                    <SideBar />
                    <div className={clsx(styles.main, isMobile && styles.mobile)}>
                        <NoSsr>
                            <Page />
                        </NoSsr>
                    </div>
                </Sync>
            </div>
        </Theme>
    </>;
}
