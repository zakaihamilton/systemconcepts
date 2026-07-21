import { MainStore } from "@components/Main";
import { render, waitFor } from "@testing-library/react";
import {
	getBrowserLocale,
	getPreferredLanguage,
	useLanguage,
	useRegionalLocale,
} from "./language";

jest.mock("@components/Main", () => {
	const { Store } = require("pullstate");
	return { MainStore: new Store({ language: "auto" }) };
});

const FIXTURE_LANGUAGES = [
	{ id: "eng", code: "en", locale: "en-US" },
	{ id: "heb", code: "he", locale: "he-IL" },
];

jest.mock("@data/languages", () => ({
	__esModule: true,
	default: [
		{ id: "eng", code: "en", locale: "en-US" },
		{ id: "heb", code: "he", locale: "he-IL" },
	],
}));

function setNavigatorLanguage(language, languages) {
	Object.defineProperty(window.navigator, "language", {
		value: language,
		configurable: true,
	});
	Object.defineProperty(window.navigator, "languages", {
		value: languages,
		configurable: true,
	});
}

function renderHook(hook) {
	let result;
	function Wrapper() {
		result = hook();
		return null;
	}
	render(<Wrapper />);
	return () => result;
}

describe("getBrowserLocale", () => {
	afterEach(() => {
		setNavigatorLanguage("en-US", ["en-US"]);
	});

	it("prefers navigator.languages[0] when available", () => {
		setNavigatorLanguage("en-US", ["he-IL", "en-US"]);
		expect(getBrowserLocale()).toBe("he-IL");
	});

	it("falls back to navigator.language when navigator.languages is empty", () => {
		setNavigatorLanguage("fr-FR", []);
		expect(getBrowserLocale()).toBe("fr-FR");
	});

	it("returns null when navigator is undefined", () => {
		const originalNavigator = global.navigator;
		Object.defineProperty(global, "navigator", {
			value: undefined,
			configurable: true,
		});
		expect(getBrowserLocale()).toBeNull();
		Object.defineProperty(global, "navigator", {
			value: originalNavigator,
			configurable: true,
		});
	});
});

describe("getPreferredLanguage", () => {
	it("matches a language by locale prefix, case-insensitively", () => {
		expect(getPreferredLanguage("HE-il")).toEqual(FIXTURE_LANGUAGES[1]);
	});

	it("falls back to the first language when locale does not match", () => {
		expect(getPreferredLanguage("fr-FR")).toEqual(FIXTURE_LANGUAGES[0]);
	});

	it("falls back to the first language when no locale is provided", () => {
		expect(getPreferredLanguage(null)).toEqual(FIXTURE_LANGUAGES[0]);
	});

	it("uses the browser locale by default", () => {
		setNavigatorLanguage("he-IL", ["he-IL"]);
		expect(getPreferredLanguage()).toEqual(FIXTURE_LANGUAGES[1]);
		setNavigatorLanguage("en-US", ["en-US"]);
	});
});

describe("useLanguage", () => {
	beforeEach(() => {
		MainStore.update((s) => {
			s.language = "auto";
		});
		setNavigatorLanguage("en-US", ["en-US"]);
	});

	it("resolves 'auto' to the preferred language based on browser locale", async () => {
		setNavigatorLanguage("he-IL", ["he-IL"]);
		const getResult = renderHook(useLanguage);
		await waitFor(() => expect(getResult()).toBe("heb"));
	});

	it("returns the explicit language when set", async () => {
		MainStore.update((s) => {
			s.language = "heb";
		});
		const getResult = renderHook(useLanguage);
		await waitFor(() => expect(getResult()).toBe("heb"));
	});
});

describe("useRegionalLocale", () => {
	it("returns the browser locale when available", async () => {
		setNavigatorLanguage("fr-FR", ["fr-FR"]);
		const getResult = renderHook(useRegionalLocale);
		await waitFor(() => expect(getResult()).toBe("fr-FR"));
		setNavigatorLanguage("en-US", ["en-US"]);
	});

	it("falls back to the first language's locale when there is no browser locale", async () => {
		const originalNavigator = global.navigator;
		Object.defineProperty(global, "navigator", {
			value: undefined,
			configurable: true,
		});
		const getResult = renderHook(useRegionalLocale);
		await waitFor(() => expect(getResult()).toBe("en-US"));
		Object.defineProperty(global, "navigator", {
			value: originalNavigator,
			configurable: true,
		});
	});
});
