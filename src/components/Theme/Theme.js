import { MainStore } from "@components/Main";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useDirection } from "@util/data/direction";
import { useEffect, useMemo } from "react";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import useDarkMode from "use-dark-mode";

// Create RTL cache
const cacheRtl = createCache({
	key: "muirtl",
	stylisPlugins: [prefixer, rtlPlugin],
});

// Create LTR cache
const cacheLtr = createCache({
	key: "muiltr",
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
					fontFamily:
						'"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
					fontSize: parseInt(fontSize, 10),
					button: {
						textTransform: "none", // Modern look: no uppercase buttons
						fontWeight: 600,
					},
					h1: { fontWeight: 700, letterSpacing: "-0.02em" },
					h2: { fontWeight: 700, letterSpacing: "-0.015em" },
					h3: { fontWeight: 600, letterSpacing: "-0.01em" },
					h4: { fontWeight: 600, letterSpacing: "-0.01em" },
					h5: { fontWeight: 600, letterSpacing: "-0.005em" },
					h6: { fontWeight: 600 },
				},
				palette: {
					mode: darkMode.value ? "dark" : "light",
					primary: {
						main: "#4f46e5", // Indigo 600
						light: "#6366f1", // Indigo 500
						dark: "#3730a3", // Indigo 800
						contrastText: "#ffffff",
					},
					secondary: {
						main: "#71717a", // Zinc 500
						light: "#a1a1aa", // Zinc 400
						dark: "#52525b", // Zinc 600
						contrastText: "#ffffff",
					},
					background: {
						default: darkMode.value ? "#09090b" : "#fafafa",
						paper: darkMode.value ? "#18181b" : "#ffffff",
					},
					text: {
						primary: darkMode.value ? "#f4f4f5" : "#18181b",
						secondary: darkMode.value ? "#a1a1aa" : "#71717a",
					},
				},
				components: {
					MuiButton: {
						styleOverrides: {
							root: {
								borderRadius: "var(--radius-md)",
								boxShadow: "none",
								transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
								"&:hover": {
									boxShadow: "var(--shadow-sm)",
									transform: "translateY(-1px)",
								},
								"&:active": {
									transform: "translateY(0px) scale(0.98)",
								},
							},
							contained: {
								boxShadow: "none",
								"&:hover": {
									boxShadow: "var(--shadow-md)",
								},
							},
						},
					},
					MuiPaper: {
						styleOverrides: {
							rounded: {
								borderRadius: "var(--radius-lg)",
							},
							elevation1: {
								boxShadow: "var(--shadow-sm)",
								border: "1px solid var(--border-color)",
							},
							elevation2: {
								boxShadow: "var(--shadow-md)",
								border: "1px solid var(--border-color)",
							},
						},
					},
					MuiAppBar: {
						styleOverrides: {
							root: {
								backgroundColor: "var(--app-bar-background)",
								color: "var(--text-primary)",
								boxShadow: "none",
								backgroundImage: "none",
								backdropFilter: "blur(12px)",
								borderBottom: "1px solid var(--border-color)",
							},
						},
					},
					MuiDrawer: {
						styleOverrides: {
							paper: {
								backgroundColor: "var(--side-bar-background)",
								borderRight: "1px solid var(--divider)",
							},
						},
					},
				},
				direction: direction,
			}),
		[darkMode.value, fontSize, direction],
	);

	useEffect(() => {
		document.body.style.fontSize = `${fontSize}px`;
	}, [fontSize]);

	useEffect(() => {
		document.documentElement.setAttribute(
			"data-theme",
			darkMode.value ? "dark" : "light",
		);
	}, [darkMode.value]);

	return (
		<CacheProvider value={direction === "rtl" ? cacheRtl : cacheLtr}>
			<ThemeProvider theme={theme}>{children}</ThemeProvider>
		</CacheProvider>
	);
}
