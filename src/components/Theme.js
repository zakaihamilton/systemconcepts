import React, { useMemo, useEffect } from "react";
import { StylesProvider, jssPreset } from "@mui/styles";
import { ThemeProvider, StyledEngineProvider, createTheme } from "@mui/material/styles";
import { create } from "jss";
import { MainStore } from "@components/Main";
import rtl from "jss-rtl";
import useDarkMode from "use-dark-mode";

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export default function Theme({ children }) {
    const darkMode = useDarkMode(false);
    const { fontSize } = MainStore.useState(s => {
        return {
            fontSize: s.fontSize
        };
    });

    const theme = useMemo(() =>
        createTheme({
            typography: {
                fontSize: parseInt(fontSize)
            },
            palette: {
                mode: darkMode.value ? "dark" : "light",
                primary: {
                    main: "#1e88e5",
                    light: "#4b9fea",
                    dark: "#155fa0"
                },
                secondary: {
                    main: "#0044ff",
                    contrastText: "#ffcc00",
                },
                tonalOffset: 0.2,
            },
        }), [darkMode.value, fontSize]);

    useEffect(() => {
        const body = document.getElementsByTagName("body");
        body[0].style.fontSize = fontSize + "px";
    }, [fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", darkMode.value ? "dark" : "light");
    }, [darkMode.value]);

    return (
        <StylesProvider jss={jss}>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    {children}
                </ThemeProvider>
            </StyledEngineProvider>
        </StylesProvider>
    );
}
