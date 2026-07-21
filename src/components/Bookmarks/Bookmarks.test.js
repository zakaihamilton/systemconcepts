import { MainStore } from "@components/Main";
import { useToolbar } from "@components/Toolbar";
import { render, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { useActivePages, usePages } from "@util/domain/views";
import storage from "@util/storage/storage";
import React from "react";
import Bookmarks, { BookmarksStore, useBookmarks } from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({
	useActivePages: jest.fn(),
	usePages: jest.fn(),
	getPagesFromHash: jest.fn(),
}));
jest.mock("@components/Toolbar");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/storage/storage");

describe("Bookmarks Component", () => {
	const mockTranslations = {
		ADD_BOOKMARK: "Add Bookmark",
		REMOVE_BOOKMARK: "Remove Bookmark",
	};

	const mockActivePages = [
		{ id: "test-page", name: "Test Page", label: "Test Label" },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		BookmarksStore.update((s) => {
			s.bookmarks = [];
			s._loaded = false;
		});
		useTranslations.mockReturnValue(mockTranslations);
		useActivePages.mockReturnValue(mockActivePages);
		usePages.mockReturnValue(mockActivePages);
		MainStore.useState.mockReturnValue({ hash: "#test" });
		storage.exists.mockResolvedValue(false);
	});

	it("renders nothing but registers toolbar items", async () => {
		render(<Bookmarks />);
		await waitFor(() =>
			expect(BookmarksStore.getRawState()._loaded).toBe(true),
		);
		expect(useToolbar).toHaveBeenCalled();
		const toolbarArgs = useToolbar.mock.calls[0][0];
		expect(toolbarArgs.id).toBe("Bookmarks");
		expect(toolbarArgs.items[0].name).toBe("Add Bookmark");
	});

	it("toggles bookmark when clicked", async () => {
		let toolbarItems = [];
		useToolbar.mockImplementation(({ items }) => {
			toolbarItems = items;
		});

		render(<Bookmarks />);
		await waitFor(() =>
			expect(BookmarksStore.getRawState()._loaded).toBe(true),
		);

		const bookmarkItem = toolbarItems.find((item) => item.id === "bookmark");
		expect(bookmarkItem).toBeDefined();

		await React.act(async () => {
			bookmarkItem.onClick({ stopPropagation: () => {} });
		});

		expect(BookmarksStore.getRawState().bookmarks).toHaveLength(1);
	});

	it("loads bookmarks from storage when the file exists", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				bookmarks: [{ id: "#saved", name: "Saved", pageId: "p1" }],
			}),
		);

		render(<Bookmarks />);
		await waitFor(() =>
			expect(BookmarksStore.getRawState().bookmarks).toHaveLength(1),
		);
		expect(BookmarksStore.getRawState().bookmarks[0].name).toBe("Saved");
	});

	it("migrates legacy localStorage bookmarks into storage", async () => {
		window.localStorage.setItem(
			"bookmarks",
			JSON.stringify({
				bookmarks: [{ id: "#legacy", name: "Legacy", pageId: "p2" }],
			}),
		);

		render(<Bookmarks />);
		await waitFor(() =>
			expect(BookmarksStore.getRawState().bookmarks).toHaveLength(1),
		);
		expect(storage.writeFile).toHaveBeenCalled();
		expect(window.localStorage.getItem("bookmarks")).toBeNull();
	});

	it("removes an existing bookmark when toggled again", async () => {
		BookmarksStore.update((s) => {
			s.bookmarks = [{ id: "#test", name: "Existing", pageId: "test-page" }];
			s._loaded = true;
		});
		let toolbarItems = [];
		useToolbar.mockImplementation(({ items }) => {
			toolbarItems = items;
		});
		useActivePages.mockReturnValue([
			{
				id: "test-page",
				name: "Test Page",
				label: "Test Label",
				sidebar: false,
			},
		]);

		render(<Bookmarks />);
		await waitFor(() => expect(toolbarItems.length).toBeGreaterThan(0));
		expect(toolbarItems[0].active).toEqual(
			expect.objectContaining({ id: "#test", name: "Existing" }),
		);

		await React.act(async () => {
			toolbarItems[0].onClick({ stopPropagation: () => {} });
		});
		expect(BookmarksStore.getRawState().bookmarks).toHaveLength(0);
	});

	it("hides the bookmark action on sidebar pages", async () => {
		useActivePages.mockReturnValue([
			{ id: "sidebar-page", sidebar: true, root: false },
		]);
		let toolbarItems = [];
		useToolbar.mockImplementation(({ items }) => {
			toolbarItems = items;
		});

		render(<Bookmarks />);
		await waitFor(() =>
			expect(BookmarksStore.getRawState()._loaded).toBe(true),
		);
		expect(toolbarItems).toEqual([]);
	});
});

describe("useBookmarks hook", () => {
	it("returns formatted bookmark items", async () => {
		BookmarksStore.update((s) => {
			s.bookmarks = [{ id: "#test", name: "Test", pageId: "test-page" }];
			s._loaded = true;
		});
		usePages.mockReturnValue([
			{ id: "test-page", name: "Test Page", label: "Test Label" },
		]);
		const { getPagesFromHash } = require("@util/domain/views");
		getPagesFromHash.mockReturnValue([
			{ id: "test-page", name: "Test Page", label: "Test Label" },
		]);

		const { result } = await renderHook(() => useBookmarks());
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Test");
	});
});

// Helper for testing hooks if needed
async function renderHook(hook) {
	let result;
	function HookWrapper() {
		result = hook();
		return null;
	}
	render(<HookWrapper />);
	await waitFor(() => expect(BookmarksStore.getRawState()._loaded).toBe(true));
	return { result };
}
