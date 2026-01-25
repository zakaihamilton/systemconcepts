import React, { useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MainStore } from '@components/Main';
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
    const { fontSize, tronMode } = MainStore.useState((s) => ({
        fontSize: s.fontSize,
        tronMode: s.tronMode
    }));

    const isDark = darkMode.value || tronMode;
    const isTron = tronMode;

    const theme = useMemo(() =>
        createTheme({
            typography: {
                fontFamily: isTron ? '"Consolas", "Monaco", "Courier New", monospace' : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: parseInt(fontSize, 10),
                button: {
                    textTransform: isTron ? 'uppercase' : 'none',
                    fontWeight: 600,
                    letterSpacing: isTron ? '0.1em' : 'normal',
                },
                h1: { fontWeight: 700 },
                h2: { fontWeight: 700 },
                h3: { fontWeight: 600 },
                h4: { fontWeight: 600 },
                h5: { fontWeight: 600 },
                h6: { fontWeight: 600 },
            },
            palette: {
                mode: isDark ? 'dark' : 'light',
                primary: {
                    main: isTron ? '#00f3ff' : '#3b82f6',
                    light: isTron ? '#e0faff' : '#60a5fa',
                    dark: isTron ? '#009099' : '#2563eb',
                    contrastText: isTron ? '#000000' : '#ffffff',
                },
                secondary: {
                    main: isTron ? '#ff00ff' : '#64748b',
                    light: isTron ? '#ffccff' : '#94a3b8',
                    dark: isTron ? '#990099' : '#475569',
                    contrastText: '#ffffff',
                },
                background: {
                    default: isTron ? '#000000' : (isDark ? '#0f172a' : '#f8fafc'),
                    paper: isTron ? '#050505' : (isDark ? '#1e293b' : '#ffffff'),
                },
                text: {
                    primary: isTron ? '#e0faff' : (isDark ? '#f1f5f9' : '#1e293b'),
                    secondary: isTron ? '#00f3ff' : (isDark ? '#94a3b8' : '#64748b'),
                }
            },
            components: {
                MuiButton: {
                    styleOverrides: {
                        root: {
                            borderRadius: isTron ? '0px' : 'var(--radius-md)',
                            boxShadow: 'none',
                            border: isTron ? '1px solid transparent' : 'none',
                            '&:hover': {
                                boxShadow: isTron ? '0 0 10px var(--primary-color)' : 'none',
                                border: isTron ? '1px solid var(--primary-color)' : 'none',
                            },
                        },
                        contained: {
                            boxShadow: isTron ? '0 0 5px var(--primary-color)' : 'none',
                            backgroundColor: isTron ? 'rgba(0, 243, 255, 0.1)' : undefined,
                            color: isTron ? '#00f3ff' : undefined,
                            border: isTron ? '1px solid var(--primary-color)' : 'none',
                            '&:hover': {
                                boxShadow: isTron ? '0 0 15px var(--primary-color)' : 'none',
                                backgroundColor: isTron ? 'rgba(0, 243, 255, 0.2)' : undefined,
                            },
                        }
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: {
                            border: isTron ? '1px solid rgba(0, 243, 255, 0.2)' : undefined,
                            boxShadow: isTron ? '0 0 5px rgba(0, 243, 255, 0.1)' : undefined,
                        },
                        rounded: {
                            borderRadius: isTron ? '0px' : 'var(--radius-lg)',
                        },
                        elevation1: {
                            boxShadow: isTron ? '0 0 5px rgba(0, 243, 255, 0.1)' : 'var(--shadow-sm)',
                        },
                        elevation2: {
                            boxShadow: isTron ? '0 0 10px rgba(0, 243, 255, 0.2)' : 'var(--shadow-md)',
                        }
                    },
                },
                MuiAppBar: {
                    styleOverrides: {
                        root: {
                            backgroundColor: 'var(--app-bar-background)',
                            color: 'var(--text-primary)',
                            boxShadow: isTron ? '0 0 10px rgba(0, 243, 255, 0.2)' : 'var(--shadow-sm)',
                            backgroundImage: 'none',
                            borderBottom: isTron ? '1px solid var(--primary-color)' : 'none',
                        }
                    }
                },
                MuiDrawer: {
                    styleOverrides: {
                        paper: {
                            backgroundColor: 'var(--side-bar-background)',
                            borderRight: '1px solid var(--divider)',
                        }
                    }
                }
            },
            direction: direction
        }), [isDark, isTron, fontSize, direction]);

    useEffect(() => {
        document.body.style.fontSize = `${fontSize}px`;
    }, [fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', tronMode ? 'tron' : (darkMode.value ? 'dark' : 'light'));
    }, [darkMode.value, tronMode]);

    return (
        <CacheProvider value={direction === "rtl" ? cacheRtl : cacheLtr}>
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        </CacheProvider>
    );
}
