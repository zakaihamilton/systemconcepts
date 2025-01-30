import React, { useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MainStore } from '@components/Main';
import rtl from 'jss-rtl';
import useDarkMode from 'use-dark-mode';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { useDirection } from "@util/direction";

// Create RTL cache
const cacheRtl = createCache({
    key: 'muirtl',
    stylisPlugins: [prefixer, rtlPlugin],
});

// Create LTR cache
const cacheLtr = createCache({
    key: 'muiltr',
    stylisPlugins: [prefixer],
});

export default function Theme({ children }) {
    const direction = useDirection();
    const darkMode = useDarkMode(false);
    const { fontSize } = MainStore.useState((s) => ({
        fontSize: s.fontSize,
    }));

    const theme = useMemo(
        () =>
            createTheme({
                typography: {
                    fontSize: parseInt(fontSize, 10), // Important: Parse with radix
                },
                palette: {
                    mode: darkMode.value ? 'dark' : 'light',
                    primary: {
                        main: '#1e88e5',
                        light: '#4b9fea',
                        dark: '#155fa0',
                    },
                    secondary: {
                        main: '#0044ff',
                        contrastText: '#ffcc00',
                    },
                    // tonalOffset is deprecated in MUI v5, use contrastThreshold instead or remove it if not needed
                    // contrastThreshold: 3,
                },
                direction: direction
            }),
        [darkMode.value, fontSize]
    );

    useEffect(() => {
        document.body.style.fontSize = `${fontSize}px`; // More concise
    }, [fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode.value ? 'dark' : 'light');
    }, [darkMode.value]);

    return (
        <CacheProvider value={direction === "rtl" ? cacheRtl : cacheLtr}>
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        </CacheProvider>
    );
}