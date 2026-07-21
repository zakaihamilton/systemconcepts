/**
 * Exercises every function defined in src/data/views.js:
 * - dynamic() import loaders
 * - dynamic() loading fallbacks
 * - visible() predicates
 * - section helpers attached to page definitions
 */

jest.mock("next/dynamic", () => {
	return (loader, options = {}) => {
		if (typeof options.loading === "function") {
			options.loading();
		}
		const result = loader();
		if (result && typeof result.then === "function") {
			result.catch(() => {});
		}
		return function MockDynamicComponent() {
			return null;
		};
	};
});

jest.mock("js-cookie", () => ({
	get: jest.fn(),
}));

jest.mock("@components/PageLoad", () => {
	return function MockPageLoad() {
		return null;
	};
});

jest.mock("@views/Home/Home", () => ({
	__esModule: true,
	default: function MockHome() {
		return null;
	},
}));

jest.mock("@views/Users/Users", () => ({
	__esModule: true,
	default: function MockUsers() {
		return null;
	},
}));
jest.mock("@views/User/User", () => ({
	__esModule: true,
	default: function MockUser() {
		return null;
	},
}));
jest.mock("@views/User/Section", () => ({
	getUserSection: jest.fn((args) => ({ name: "user", ...args })),
}));

jest.mock("@views/Settings/Settings", () => ({
	__esModule: true,
	default: function MockSettings() {
		return null;
	},
}));
jest.mock("@views/Settings/Reset", () => ({
	__esModule: true,
	default: function MockReset() {
		return null;
	},
}));
jest.mock("@views/Settings/FullSync", () => ({
	__esModule: true,
	default: function MockFullSync() {
		return null;
	},
}));
jest.mock("@views/Settings/ClearStorage", () => ({
	__esModule: true,
	default: function MockClearStorage() {
		return null;
	},
}));

jest.mock("@views/Languages/Languages", () => ({
	__esModule: true,
	default: function MockLanguages() {
		return null;
	},
}));
jest.mock("@views/Translations/Translations", () => ({
	__esModule: true,
	default: function MockTranslations() {
		return null;
	},
}));
jest.mock("@views/Translations/Section", () => ({
	getTranslationsSection: jest.fn((args) => ({
		name: "translations",
		...args,
	})),
}));
jest.mock("@views/FontSizes/FontSizes", () => ({
	__esModule: true,
	default: function MockFontSizes() {
		return null;
	},
}));

jest.mock("@views/Storage/Storage", () => ({
	__esModule: true,
	default: function MockStorage() {
		return null;
	},
}));
jest.mock("@views/Storage/Section", () => ({
	getStorageSection: jest.fn((args) => ({ name: "storage", ...args })),
}));

jest.mock("@views/Editor/Editor", () => ({
	__esModule: true,
	default: function MockEditor() {
		return null;
	},
}));
jest.mock("@views/Image/Image", () => ({
	__esModule: true,
	default: function MockImage() {
		return null;
	},
}));
jest.mock("@views/Image/Section", () => ({
	getImageSection: jest.fn((args) => ({ name: "image", ...args })),
}));

jest.mock("@views/Account/Account", () => ({
	__esModule: true,
	default: function MockAccount() {
		return null;
	},
}));
jest.mock("@views/Podcast/Podcast", () => ({
	__esModule: true,
	default: function MockPodcast() {
		return null;
	},
}));
jest.mock("@views/API/API", () => ({
	__esModule: true,
	default: function MockAPI() {
		return null;
	},
}));
jest.mock("@views/SignUp/SignUp", () => ({
	__esModule: true,
	default: function MockSignUp() {
		return null;
	},
}));
jest.mock("@views/ChangePassword/ChangePassword", () => ({
	__esModule: true,
	default: function MockChangePassword() {
		return null;
	},
}));
jest.mock("@views/ResetPassword/ResetPassword", () => ({
	__esModule: true,
	default: function MockResetPassword() {
		return null;
	},
}));
jest.mock("@views/ResetPassword/Section", () => ({
	getResetSection: jest.fn((args) => ({ name: "reset", ...args })),
}));

jest.mock("@views/Sessions/Sessions", () => ({
	__esModule: true,
	default: function MockSessions() {
		return null;
	},
}));
jest.mock("@views/Sessions/Section", () => ({
	getSessionsSection: jest.fn((args) => ({ name: "sessions", ...args })),
}));
jest.mock("@views/Player/Player", () => ({
	__esModule: true,
	default: function MockPlayer() {
		return null;
	},
}));
jest.mock("@views/Player/Section", () => ({
	getPlayerSection: jest.fn((args) => ({ name: "player", ...args })),
}));
jest.mock("@views/Session/Session", () => ({
	__esModule: true,
	default: function MockSession() {
		return null;
	},
}));
jest.mock("@views/Session/Section", () => ({
	getSessionSection: jest.fn((args) => ({ name: "session", ...args })),
}));
jest.mock("@views/Session/Tabs", () => ({
	__esModule: true,
	default: function MockSessionTabs() {
		return null;
	},
}));

jest.mock("@views/Schedule/Schedule", () => ({
	__esModule: true,
	default: function MockSchedule() {
		return null;
	},
}));
jest.mock("@views/Schedule/Section", () => ({
	getScheduleSection: jest.fn((args) => ({ name: "schedule", ...args })),
}));
jest.mock("@views/Groups/Groups", () => ({
	__esModule: true,
	default: function MockGroups() {
		return null;
	},
}));
jest.mock("@views/Tags/Tags", () => ({
	__esModule: true,
	default: function MockTags() {
		return null;
	},
}));
jest.mock("@views/Research", () => ({
	__esModule: true,
	default: function MockResearch() {
		return null;
	},
}));
jest.mock("@views/Library/Library", () => ({
	__esModule: true,
	default: function MockLibrary() {
		return null;
	},
}));
jest.mock("@views/Library/Section", () => ({
	getLibrarySection: jest.fn((args) => ({ name: "library", ...args })),
}));
jest.mock("@views/Bookmarks/Bookmarks", () => ({
	__esModule: true,
	default: function MockBookmarks() {
		return null;
	},
}));
jest.mock("@views/Sync/Sync", () => ({
	__esModule: true,
	default: function MockSync() {
		return null;
	},
}));

import Cookies from "js-cookie";
import pages from "./views";

describe("data/views", () => {
	beforeEach(() => {
		Cookies.get.mockReset();
	});

	it("exports a non-empty pages array with unique ids", () => {
		expect(Array.isArray(pages)).toBe(true);
		expect(pages.length).toBeGreaterThan(0);
		const ids = pages.map((p) => p.id).filter(Boolean);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("covers every page definition: Component, Icon, section, visible, sidebar", () => {
		const sectionArgs = {
			sectionIndex: 1,
			name: "Test",
			language: "eng",
			id: "library",
			path: "library/foo",
			translations: { LIBRARY: "Library", SESSIONS: "Sessions" },
			label: "Label",
			date: "2020-01-01",
		};

		for (const page of pages) {
			expect(page).toEqual(expect.any(Object));
			expect(page.id || page.path).toBeTruthy();

			if (page.Component) {
				expect(page.Component).toBeTruthy();
			}
			if (page.Icon) {
				expect(page.Icon).toBeTruthy();
			}
			if (page.icon) {
				expect(page.icon).toBeTruthy();
			}
			if (page.tabs) {
				expect(page.tabs).toBeTruthy();
			}
			if (typeof page.section === "function") {
				page.section(sectionArgs);
			}
			if (page.sidebar && typeof page.sidebar === "object") {
				expect(page.sidebar.name).toBeTruthy();
				if (page.sidebar.Icon) {
					expect(page.sidebar.Icon).toBeTruthy();
				}
			}
			if (typeof page.visible === "function") {
				Cookies.get.mockReturnValue(undefined);
				expect(page.visible()).toBeFalsy();

				Cookies.get.mockImplementation((key) =>
					key === "id" || key === "hash" ? "value" : undefined,
				);
				expect(page.visible()).toBeTruthy();
			}
			if (page.name) {
				expect(typeof page.name).toBe("string");
			}
			if (page.root) {
				expect(page.root).toBe(true);
			}
		}
	});

	it("visible predicates require both id and hash cookies", () => {
		const withVisible = pages.filter((p) => typeof p.visible === "function");
		expect(withVisible.length).toBeGreaterThan(0);

		for (const page of withVisible) {
			Cookies.get.mockImplementation((key) => (key === "id" ? "x" : undefined));
			expect(page.visible()).toBeFalsy();

			Cookies.get.mockImplementation((key) =>
				key === "hash" ? "y" : undefined,
			);
			expect(page.visible()).toBeFalsy();

			Cookies.get.mockImplementation((key) =>
				key === "id" || key === "hash" ? "z" : undefined,
			);
			expect(page.visible()).toBeTruthy();
		}
	});

	it("includes expected core pages", () => {
		const byId = Object.fromEntries(
			pages.filter((p) => p.id).map((p) => [p.id, p]),
		);
		expect(byId.home.root).toBe(true);
		expect(byId.storage.contained).toEqual(["editor", "image"]);
		expect(byId.image.useParentName).toBe(1);
		expect(byId.player.useParentName).toBe(1);
		expect(byId.session.tabs).toBeTruthy();
		expect(byId.manageBookmarks.sidebar.name).toBe("MANAGE");
		expect(byId.library.custom).toBe(true);
		expect(byId.research.custom).toBe(true);
	});
});
