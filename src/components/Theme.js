import React, { useMemo, useEffect } from "react";
import { StylesProvider, ThemeProvider, jssPreset } from "@material-ui/styles";
import { create } from "jss";
import { createMuiTheme } from "@material-ui/core/styles";
import { MainStore } from "@components/Main";
import rtl from "jss-rtl";
import useDarkMode from 'use-dark-mode';

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export default function Theme({ children }) {
    const darkMode = useDarkMode(false);
    const { fontSize } = MainStore.useState(s => {
        return {
            fontSize: s.fontSize
        };
    });

    const theme = useMemo(() =>
        createMuiTheme({
            typography: {
                fontSize: parseInt(fontSize)
            },
            palette: {
                type: darkMode.value ? 'dark' : 'light',
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
        }), [darkMode.value, fontSize]);

    useEffect(() => {
        const body = document.getElementsByTagName('body');
        body[0].style.fontSize = fontSize + "px";
    }, [fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode.value ? 'dark' : 'light');
    }, [darkMode.value]);

    return <StylesProvider jss={jss}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </StylesProvider>;
}
