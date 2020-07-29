import React, { useMemo, useEffect } from "react";
import { StylesProvider, ThemeProvider, jssPreset } from "@material-ui/styles";
import { create } from "jss";
import { createMuiTheme } from "@material-ui/core/styles";
import { MainStore } from "@/components/Main";
import rtl from "jss-rtl";

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export default function Theme({ children }) {
    const { darkMode } = MainStore.useState();

    const theme = useMemo(() =>
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

    return <StylesProvider jss={jss}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </StylesProvider>;
}
