// Runs before React so the page starts with the saved or system color theme.
(function initializeTheme() {
	const storageKey = "darkMode";
	const classNameDark = "dark-mode";
	const classNameLight = "light-mode";

	function setClassOnDocumentBody(darkMode: boolean) {
		document.body.classList.add(darkMode ? classNameDark : classNameLight);
		document.body.classList.remove(darkMode ? classNameLight : classNameDark);
		document.documentElement.setAttribute(
			"data-theme",
			darkMode ? "dark" : "light",
		);
	}

	const preferDarkQuery = "(prefers-color-scheme: dark)";
	const mediaQuery = window.matchMedia(preferDarkQuery);
	const supportsColorSchemeQuery = mediaQuery.media === preferDarkQuery;
	let localStorageTheme: string | null = null;
	try {
		localStorageTheme = localStorage.getItem(storageKey);
	} catch {}

	if (localStorageTheme !== null) {
		setClassOnDocumentBody(JSON.parse(localStorageTheme) as boolean);
	} else if (supportsColorSchemeQuery) {
		setClassOnDocumentBody(mediaQuery.matches);
		localStorage.setItem(storageKey, String(mediaQuery.matches));
	} else {
		const isDarkMode = document.body.classList.contains(classNameDark);
		localStorage.setItem(storageKey, JSON.stringify(isDarkMode));
	}
})();
