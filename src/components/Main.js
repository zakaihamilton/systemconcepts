import React, { useEffect } from "react";
import AppBar from "./AppBar";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useStyles, useDeviceType } from "@/util/styles";
import Page from "./Page";
import Theme from "./Theme";
import { useLanguage } from "@/util/language";
import Sync from "./Sync";
import Audio from "@/widgets/Audio";
import Fullscreen from "./Fullscreen";
import { AudioPlayerProvider } from "react-use-audio-player";
import Header from "./Header";

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
    const language = useLanguage();
    const isPhone = useDeviceType() === "phone";
    useLocalStorage("MainStore", MainStore);
    const { direction, showSideBar, menuViewList, hash, fullscreen } = MainStore.useState();

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
        sidebar: showSideBar && !isPhone && !fullscreen,
        list: menuViewList === "List",
        rtl: direction === "rtl",
        fullscreen
    });

    return <>
        <Header />
        <Theme>
            <AudioPlayerProvider>
                <div className={className}>
                    <Sync />
                    <Audio />
                    <Fullscreen />
                    {!fullscreen && <AppBar />}
                    <SideBar />
                    <div className={styles.main}>
                        <Page />
                    </div>
                </div>
            </AudioPlayerProvider>
        </Theme>
    </>;
}
