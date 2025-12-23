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
    const { fontSize } = MainStore.useState((s) => ({
        fontSize: s.fontSize,
    }));

    const theme = useMemo(() =>
        createTheme({
            typography: {
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: parseInt(fontSize, 10),
                button: {
                    textTransform: 'none', // Modern look: no uppercase buttons
                    fontWeight: 600,
                },
                h1: { fontWeight: 700 },
                h2: { fontWeight: 700 },
                h3: { fontWeight: 600 },
                h4: { fontWeight: 600 },
                h5: { fontWeight: 600 },
                h6: { fontWeight: 600 },
            },
            palette: {
                mode: darkMode.value ? 'dark' : 'light',
                primary: {
                    main: '#3b82f6', // Blue 500
                    light: '#60a5fa', // Blue 400
                    dark: '#2563eb', // Blue 600
                    contrastText: '#ffffff',
                },
                secondary: {
                    main: '#64748b', // Slate 500
                    light: '#94a3b8', // Slate 400
                    dark: '#475569', // Slate 600
                    contrastText: '#ffffff',
                },
                background: {
                    default: darkMode.value ? '#0f172a' : '#f8fafc',
                    paper: darkMode.value ? '#1e293b' : '#ffffff',
                },
                text: {
                    primary: darkMode.value ? '#f1f5f9' : '#1e293b',
                    secondary: darkMode.value ? '#94a3b8' : '#64748b',
                }
            },
            components: {
                MuiButton: {
                    styleOverrides: {
                        root: {
                            borderRadius: '8px', // Rounded corners
                            boxShadow: 'none',
                            '&:hover': {
                                boxShadow: 'none',
                            },
                        },
                        contained: {
                            boxShadow: 'none',
                            '&:hover': {
                                boxShadow: 'none',
                            },
                        }
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        rounded: {
                            borderRadius: '12px',
                        },
                        elevation1: {
                            boxShadow: darkMode.value
                                ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.16)'
                                : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // Tailwind shadow-sm
                        },
                        elevation2: {
                             boxShadow: darkMode.value
                                ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)'
                                : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Tailwind shadow-md
                        }
                    },
                },
                MuiAppBar: {
                    styleOverrides: {
                        root: {
                            backgroundColor: darkMode.value ? '#1e293b' : '#ffffff',
                            color: darkMode.value ? '#f1f5f9' : '#1e293b',
                            boxShadow: darkMode.value
                                ? '0 1px 2px 0 rgba(0, 0, 0, 0.3)'
                                : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            backgroundImage: 'none', // Remove default MUI gradient in dark mode
                        }
                    }
                },
                MuiDrawer: {
                    styleOverrides: {
                        paper: {
                            backgroundColor: darkMode.value ? '#0f172a' : '#f8fafc',
                            borderRight: `1px solid ${darkMode.value ? '#334155' : '#e2e8f0'}`,
                        }
                    }
                }
            },
            direction: direction
        }), [darkMode.value, fontSize, direction]);

    useEffect(() => {
        document.body.style.fontSize = `${fontSize}px`;
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
