import { MainStore } from "@components/Main";
import { render, waitFor } from "@testing-library/react";
import { useLanguage } from "@util/domain/language";
import { useTranslations } from "@util/domain/translations";

jest.mock("@components/Main", () => {
	const { Store } = require("pullstate");
	return { MainStore: new Store({ hash: "" }) };
});

jest.mock("@util/domain/language", () => ({
	useLanguage: jest.fn(() => "eng"),
}));

jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(() => ({})),
}));

const FIXTURE_PAGES = [
	{ id: "home", root: true, name: "HOME" },
	{ id: "settings", name: "SETTINGS" },
	{
		id: "storage",
		name: "STORAGE",
		path: "storage",
		contained: ["editor"],
	},
	{ id: "editor", name: "EDITOR" },
	{
		id: "user",
		name: "USER",
		section: ({ name }) => (name ? { name: `User: ${name}` } : null),
	},
	{
		id: "player",
		name: "PLAYER",
		useParentName: 1,
	},
	{
		id: "research",
		path: "research",
		custom: true,
		name: "RESEARCH",
	},
];

jest.mock(
	"@data/views",
	() => ({
		default: FIXTURE_PAGES,
	}),
	{ virtual: true },
);

const {
	addPath,
	getPagesFromHash,
	getOrigin,
	goBackPage,
	replacePath,
	reloadPage,
	setHash,
	setPath,
	toPath,
	urlToParentPath,
	useActivePages,
	useCurrentPage,
	useCurrentPageTitle,
	useParentParams,
	useParentPath,
	usePages,
	usePathItems,
} = require("./views");

function renderHook(hook) {
	let result;
	function Wrapper() {
		result = hook();
		return null;
	}
	render(<Wrapper />);
	return () => result;
}

beforeEach(() => {
	jest.clearAllMocks();
	useLanguage.mockReturnValue("eng");
	useTranslations.mockReturnValue({});
	MainStore.update((s) => {
		s.hash = "";
	});
	window.location.hash = "";
});

describe("toPath", () => {
	it("joins encoded path components with slashes", () => {
		expect(toPath("a", "b")).toBe("a/b");
	});

	it("encodes special characters but preserves colons", () => {
		expect(toPath("group:name", "a b")).toBe("group:name/a%20b");
	});
});

describe("urlToParentPath", () => {
	it("returns the decoded second-to-last path segment", () => {
		expect(urlToParentPath("a/b/c")).toBe("b");
	});

	it("returns an empty string when there is no parent segment", () => {
		expect(urlToParentPath("a")).toBe("");
	});

	it("decodes percent-encoded parent segments", () => {
		expect(urlToParentPath("a/group%3Aname/c")).toBe("group:name");
	});
});

describe("setHash / setPath / addPath / replacePath / goBackPage", () => {
	it("setHash updates MainStore and window.location.hash", () => {
		setHash("foo/bar");
		expect(MainStore.getRawState().hash).toBe("foo/bar");
		expect(window.location.hash).toBe("#foo/bar");
	});

	it("setPath strips a leading # from the first segment and encodes the rest", () => {
		setPath("#foo", "bar baz");
		expect(MainStore.getRawState().hash).toBe("foo/bar%20baz");
	});

	it("addPath appends encoded segments to the current hash", () => {
		window.location.hash = "#existing";
		addPath("next", "step two");
		expect(MainStore.getRawState().hash).toBe("#existing/next/step%20two");
	});

	it("replacePath replaces the last segment of the current hash", () => {
		window.location.hash = "#a/b/c";
		replacePath("d");
		expect(MainStore.getRawState().hash).toBe("a/b/d");
	});

	it("goBackPage removes the last segment of the current hash", () => {
		window.location.hash = "#a/b/c";
		goBackPage();
		expect(MainStore.getRawState().hash).toBe("a/b");
	});
});

describe("getOrigin / reloadPage", () => {
	it("returns window.location.origin", () => {
		expect(getOrigin()).toBe(window.location.origin);
	});

	it("reloads the page without throwing", () => {
		const consoleError = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});
		expect(() => reloadPage()).not.toThrow();
		consoleError.mockRestore();
	});
});

describe("getPagesFromHash", () => {
	it("prepends the root page when the hash is empty", () => {
		const results = getPagesFromHash({
			hash: "",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("home");
	});

	it("does not duplicate the root page when it is already present", () => {
		const results = getPagesFromHash({
			hash: "#home",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("home");
	});

	it("resolves multiple segments and injects the root page when missing", () => {
		const results = getPagesFromHash({
			hash: "#settings",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results.map((page) => page.id)).toEqual(["home", "settings"]);
		expect(results[1].parentPath).toBe("");
	});

	it("resolves an allowed contained sub-page", () => {
		const results = getPagesFromHash({
			hash: "#home/storage/editor",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results.map((page) => page.id)).toEqual([
			"home",
			"storage",
			"editor",
		]);
	});

	it("clones the parent page for a contained-but-disallowed sub-path", () => {
		const results = getPagesFromHash({
			hash: "#home/storage/somefile",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results).toHaveLength(3);
		expect(results[2].id).toBe("storage");
		expect(results[2].path).toBe("somefile");
		expect(results[2].url).toBe("storage/somefile");
	});

	it("returns null (skips the segment) when no page matches", () => {
		const results = getPagesFromHash({
			hash: "#home/does-not-exist",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results.map((page) => page.id)).toEqual(["home"]);
	});

	it("resolves query parameters into the page object", () => {
		const results = getPagesFromHash({
			hash: "#home/user?name=Alice",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		const userPage = results.find((page) => page.id === "user");
		expect(userPage.name).toBe("User: Alice");
	});

	it("skips a page when its section function returns falsy", () => {
		const results = getPagesFromHash({
			hash: "#home/user",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results.map((page) => page.id)).toEqual(["home"]);
	});

	it("sets a tooltip when the resolved name differs from the definition name", () => {
		const results = getPagesFromHash({
			hash: "#home/user?name=Bob",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		const userPage = results.find((page) => page.id === "user");
		expect(userPage.tooltip).toBe("USER");
	});

	it("matches custom pages using their id as a pattern", () => {
		const results = getPagesFromHash({
			hash: "#home/research",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results.map((page) => page.id)).toEqual(["home", "research"]);
	});

	it("treats a leading query-only segment as belonging to the root page", () => {
		const results = getPagesFromHash({
			hash: "?tab=1",
			translations: {},
			pages: FIXTURE_PAGES,
		});
		expect(results[0].id).toBe("home");
		expect(results[0].tab).toBe("1");
	});

	it("uses sectionPath prefixes and useParentName when allowed contained pages have a name param", () => {
		const pages = [
			{ id: "home", root: true, name: "HOME" },
			{
				id: "storage",
				name: "STORAGE",
				path: "storage",
				contained: ["editor"],
			},
			{
				id: "editor",
				name: "EDITOR",
				section: ({ name }) => ({ name: name || "EDITOR" }),
			},
		];
		const results = getPagesFromHash({
			hash: "#home/storage/editor?name=Doc",
			translations: {},
			pages,
		});
		const editor = results.find((page) => page.id === "editor");
		expect(editor.useParentName).toBe(1);
		expect(editor.path).toContain("Doc");
	});

	it("falls back to pageId matching when custom pattern misses", () => {
		const pages = [
			{ id: "home", root: true, name: "HOME" },
			{ id: "player", name: "PLAYER", custom: true },
		];
		const results = getPagesFromHash({
			hash: "#home/player",
			translations: {},
			pages,
		});
		expect(results.map((p) => p.id)).toEqual(["home", "player"]);
	});

	it("keeps an existing tooltip when the resolved name changes", () => {
		const pages = [
			{ id: "home", root: true, name: "HOME" },
			{
				id: "user",
				name: "USER",
				tooltip: "Existing",
				section: ({ name }) => ({ name: `User: ${name}` }),
			},
		];
		const results = getPagesFromHash({
			hash: "#home/user?name=Ada",
			translations: {},
			pages,
		});
		expect(results.find((p) => p.id === "user").tooltip).toBe("Existing");
	});

	it("builds sectionPath prefixes when nested sections are allowed", () => {
		const pages = [
			{ id: "home", root: true, name: "HOME" },
			{
				id: "storage",
				name: "STORAGE",
				path: "storage",
				contained: ["editor"],
			},
			{
				id: "editor",
				name: "EDITOR",
				section: ({ path }) => ({ path }),
			},
		];
		const results = getPagesFromHash({
			hash: "#home/storage/editor?name=Doc",
			translations: {},
			pages,
		});
		const editor = results.find((page) => page.id === "editor");
		expect(editor.path).toContain("Doc");
	});

	it("extends sectionPath across three allowed nested segments", () => {
		const pages = [
			{ id: "home", root: true, name: "HOME" },
			{
				id: "storage",
				name: "STORAGE",
				path: "storage",
				contained: ["editor", "preview"],
			},
			{
				id: "editor",
				name: "EDITOR",
				contained: ["preview"],
				section: ({ path }) => ({ path }),
			},
			{
				id: "preview",
				name: "PREVIEW",
				section: ({ path }) => ({ path }),
			},
		];
		const results = getPagesFromHash({
			hash: "#home/storage/editor/preview?file=one",
			translations: {},
			pages,
		});
		expect(results.map((page) => page.id)).toEqual([
			"home",
			"storage",
			"editor",
			"preview",
		]);
		const preview = results.find((page) => page.id === "preview");
		expect(preview).toBeTruthy();
		expect(preview.url).toContain("preview");
	});

	it("works without a root page definition", () => {
		const pages = [{ id: "settings", name: "SETTINGS" }];
		const results = getPagesFromHash({
			hash: "settings",
			translations: {},
			pages,
		});
		expect(results.map((p) => p.id)).toEqual(["settings"]);
	});
});

describe("usePathItems", () => {
	it("returns decoded, non-empty hash segments", async () => {
		MainStore.update((s) => {
			s.hash = "#home/group%3Aname";
		});
		const getResult = renderHook(usePathItems);
		await waitFor(() => expect(getResult()).toEqual(["home", "group:name"]));
	});

	it("returns an empty array when there is no hash", async () => {
		const getResult = renderHook(usePathItems);
		await waitFor(() => expect(getResult()).toEqual([]));
	});
});

describe("useParentPath / useParentParams", () => {
	it("returns the parent path segment relative to the current hash", async () => {
		MainStore.update((s) => {
			s.hash = "#a/b/c";
		});
		const getResult = renderHook(() => useParentPath());
		await waitFor(() => expect(getResult()).toBe("b"));
	});

	it("supports an index offset for deeper ancestors", async () => {
		MainStore.update((s) => {
			s.hash = "#a/b/c/d";
		});
		const getResult = renderHook(() => useParentPath(1));
		await waitFor(() => expect(getResult()).toBe("b"));
	});

	it("parses query params from the parent path", async () => {
		MainStore.update((s) => {
			s.hash = "#a/b?name=Alice&sort=asc/c";
		});
		const getResult = renderHook(() => useParentParams());
		await waitFor(() =>
			expect(getResult()).toEqual({ name: "Alice", sort: "asc" }),
		);
	});
});

describe("usePages / useActivePages / useCurrentPage / useCurrentPageTitle", () => {
	it("usePages maps translation keys and filters hidden pages", async () => {
		useTranslations.mockReturnValue({ SETTINGS: "Settings Label" });
		const getResult = renderHook(() => usePages());
		await waitFor(() => {
			const pages = getResult();
			const settingsPage = pages.find((page) => page.id === "settings");
			expect(settingsPage.name).toBe("Settings Label");
		});
	});

	it("usePages maps localized object names and mode-specific icons", async () => {
		const React = require("react");
		FIXTURE_PAGES.push({
			id: "modeful",
			name: { eng: "English Name", heb: "Hebrew Name" },
			visible: () => true,
			Icon: () => React.createElement("span", null, "default"),
			sidebar: {
				Icon: () => React.createElement("span", null, "side"),
				name: "SIDEBAR_NAME",
				label: "SIDEBAR_LABEL",
			},
		});
		FIXTURE_PAGES.push({
			id: "hidden",
			name: "HIDDEN",
			visible: false,
		});
		FIXTURE_PAGES.push({
			id: "undef-visible",
			name: "UNDEF",
		});

		useLanguage.mockReturnValue("eng");
		useTranslations.mockReturnValue({ SIDEBAR_NAME: "Side Name" });
		const getResult = renderHook(() => usePages("sidebar"));
		await waitFor(() => {
			const pages = getResult();
			expect(pages.find((p) => p.id === "hidden")).toBeUndefined();
			expect(pages.find((p) => p.id === "modeful").name).toBe("Side Name");
			expect(pages.find((p) => p.id === "undef-visible")).toBeTruthy();
		});

		FIXTURE_PAGES.splice(
			FIXTURE_PAGES.findIndex((p) => p.id === "modeful"),
			3,
		);
	});

	it("usePages maps Hebrew object names when language is heb", async () => {
		useLanguage.mockReturnValue("heb");
		FIXTURE_PAGES.push({
			id: "hebrew",
			name: { eng: "English", heb: "Hebrew" },
		});

		const getResult = renderHook(() => usePages());
		await waitFor(() =>
			expect(getResult().find((p) => p.id === "hebrew").name).toBe("Hebrew"),
		);

		FIXTURE_PAGES.splice(
			FIXTURE_PAGES.findIndex((p) => p.id === "hebrew"),
			1,
		);
		useLanguage.mockReturnValue("eng");
	});

	it("setPath encodes segments that do not start with #", () => {
		setPath("plain", "x y");
		expect(MainStore.getRawState().hash).toBe("plain/x%20y");
	});

	it("useParentPath returns empty string without a parent", async () => {
		MainStore.update((s) => {
			s.hash = "#only";
		});
		const getResult = renderHook(() => useParentPath());
		await waitFor(() => expect(getResult()).toBe(""));
	});

	it("usePathItems strips a leading hash from MainStore hash", async () => {
		MainStore.update((s) => {
			s.hash = "nohash/segment";
		});
		const getResult = renderHook(usePathItems);
		await waitFor(() => expect(getResult()).toEqual(["nohash", "segment"]));
	});

	it("useActivePages accepts a depends array", async () => {
		MainStore.update((s) => {
			s.hash = "#home/settings";
		});
		const getResult = renderHook(() => useActivePages(["a"]));
		await waitFor(() =>
			expect(getResult().map((page) => page.id)).toEqual(["home", "settings"]),
		);
	});

	it("useCurrentPageTitle prefers label over name", async () => {
		FIXTURE_PAGES.find((p) => p.id === "settings").label = "Settings Label";
		MainStore.update((s) => {
			s.hash = "#home/settings";
		});
		const getResult = renderHook(() => useCurrentPageTitle());
		await waitFor(() => expect(getResult()).toBe("Settings Label"));
		delete FIXTURE_PAGES.find((p) => p.id === "settings").label;
	});

	it("useActivePages resolves the pages for the current hash", async () => {
		MainStore.update((s) => {
			s.hash = "#home/settings";
		});
		const getResult = renderHook(() => useActivePages());
		await waitFor(() =>
			expect(getResult().map((page) => page.id)).toEqual(["home", "settings"]),
		);
	});

	it("useCurrentPage returns the last resolved page", async () => {
		MainStore.update((s) => {
			s.hash = "#home/settings";
		});
		const getResult = renderHook(() => useCurrentPage());
		await waitFor(() => expect(getResult().id).toBe("settings"));
	});

	it("useCurrentPage accounts for useParentName offsets", async () => {
		MainStore.update((s) => {
			s.hash = "#home/player";
		});
		const getResult = renderHook(() => useCurrentPage());
		await waitFor(() => expect(getResult().id).toBe("home"));
	});

	it("useCurrentPageTitle returns the page label or name unless it is the root", async () => {
		MainStore.update((s) => {
			s.hash = "#home/settings";
		});
		const getResult = renderHook(() => useCurrentPageTitle());
		await waitFor(() => expect(getResult()).toBe("SETTINGS"));
	});

	it("useCurrentPageTitle returns an empty string for the root page", async () => {
		MainStore.update((s) => {
			s.hash = "";
		});
		const getResult = renderHook(() => useCurrentPageTitle());
		await waitFor(() => expect(getResult()).toBe(""));
	});
});
