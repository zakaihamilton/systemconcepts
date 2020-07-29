import React, { useEffect } from "react";
import Head from "next/head"
import AppBar from "./AppBar";
import StatusBar from "./StatusBar";
import SideBar from "./SideBar";
import styles from "./Main.module.scss";
import { Store } from "pullstate";
import { useStyles } from "@/util/styles";
import { useImportMedia } from "@/util/styles";
import { getPagesFromHash } from "@/util/pages";
import Breadcrumbs from "./Breadcrumbs";
import Page from "./Page";
import Theme from "./Theme";
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { createMuiTheme } from "@material-ui/core/styles";

export const MainStore = new Store({
    darkMode: false,
    direction: "ltr",
    language: "eng",
    menuViewList: "List",
    showSideBar: true
});

export default function Main() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const isMobile = useImportMedia(im => im.lessThan('tablet'));
    const { darkMode, direction, language, showSideBar, menuViewList, hash } = MainStore.useState();
    const pages = getPagesFromHash(hash);
    const activePage = pages[pages.length - 1];

    const theme = React.useMemo(() =>
        createMuiTheme({
            palette: {
                type: darkMode ? 'dark' : 'light',
                primary: {
                    main: "#1e88e5",
                    light: "#4b9fea",
                    dark: "#155fa0"
                },
                secondary: {
                    main: '#0044ff',
                    contrastText: '#ffcc00',
                },
                tonalOffset: 0.2,
            },
        }), [darkMode]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

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
            s.darkMode = prefersDarkMode;
        });
    }, [prefersDarkMode]);

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
            <title>System Concepts</title>
            <link rel="icon" href="/favicon.ico" />
        </Head>
        <Theme theme={theme}>
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
