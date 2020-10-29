import React, { useMemo, useEffect } from "react";
import { StylesProvider, ThemeProvider, jssPreset } from "@material-ui/styles";
import { create } from "jss";
import { createMuiTheme } from "@material-ui/core/styles";
import { MainStore } from "@components/Main";
import rtl from "jss-rtl";

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export function prefersDarkMode() {
    return (window.matchMedia('(prefers-color-scheme)').media !== 'not all');
}

export default function Theme({ children }) {
    const { darkMode, fontSize, autoDetectDarkMode, _loaded } = MainStore.useState(s => {
        return {
            darkMode: s.darkMode,
            fontSize: s.fontSize,
            autoDetectDarkMode: s.autoDetectDarkMode,
            _loaded: s._loaded
        };
    });

    const theme = useMemo(() =>
        createMuiTheme({
            typography: {
                fontSize: parseInt(fontSize)
            },
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
        }), [darkMode, fontSize]);

    useEffect(() => {
        const body = document.getElementsByTagName('body');
        body[0].style.fontSize = fontSize + "px";
    }, [fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        if (_loaded && autoDetectDarkMode) {
            MainStore.update(s => {
                s.darkMode = prefersDarkMode();
            });
        }
    }, [_loaded, autoDetectDarkMode]);

    return <StylesProvider jss={jss}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </StylesProvider>;
}
