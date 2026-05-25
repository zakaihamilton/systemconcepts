import { MainStore } from "@components/Main";
import languages from "@data/languages";

export function getBrowserLocale() {
	if (typeof navigator === "undefined") {
		return null;
	}
	return navigator.languages?.[0] || navigator.language || null;
}

export function getPreferredLanguage(locale = getBrowserLocale()) {
	return (
		(locale &&
			languages.find((item) =>
				locale.toLowerCase().startsWith(item.code.toLowerCase()),
			)) ||
		languages[0]
	);
}

export function useLanguage() {
	let { language } = MainStore.useState();
	if (language === "auto") {
		language = getPreferredLanguage().id;
	}
	return language;
}

export function useRegionalLocale() {
	return getBrowserLocale() || languages[0].locale;
}
