import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { logger } from "@util/api/logger";
import { setPath, usePathItems } from "@util/domain/views";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import Library from "./index.js";

jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));

jest.mock("@util/storage/storage");
jest.mock("@util/domain/views", () => ({
	setPath: jest.fn(),
	usePathItems: jest.fn(),
}));
jest.mock("@components/Main", () => {
	const { Store } = require("pullstate");
	return {
		MainStore: new Store({ hash: "" }),
	};
});
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn((selector) =>
			selector ? selector({ libraryUpdateCounter: 0 }) : 0,
		),
	},
}));
jest.mock("../Store", () => {
	const state = {
		tags: [],
		lastViewedArticle: null,
		scrollToParagraph: null,
		selectedId: null,
	};
	return {
		LibraryStore: {
			useState: jest.fn((selector) =>
				typeof selector === "function" ? selector(state) : state,
			),
			update: jest.fn((updater) => {
				if (typeof updater === "function") updater(state);
			}),
			getRawState: jest.fn(() => state),
			__state: state,
		},
	};
});
jest.mock("js-cookie");
jest.mock("../Article", () => (props) => (
	<div data-testid="article">
		<span data-testid="article-content">{props.content}</span>
		<span data-testid="article-loading">{String(!!props.loading)}</span>
		<span data-testid="article-selected">{props.selectedTag?._id || ""}</span>
		<span data-testid="article-prev-name">{props.prevArticle?.name || ""}</span>
		<span data-testid="article-next-name">{props.nextArticle?.name || ""}</span>
		<button type="button" onClick={props.openEditDialog}>
			open-edit-tags
		</button>
		<button type="button" onClick={props.openEditContentDialog}>
			open-edit-content
		</button>
		<button type="button" onClick={props.onPrev}>
			goto-prev
		</button>
		<button type="button" onClick={props.onNext}>
			goto-next
		</button>
	</div>
));
jest.mock("../EditTagsDialog", () => (props) => (
	<div data-testid="edit-tags-dialog" data-open={String(!!props.open)}>
		<button type="button" onClick={props.onClose}>
			close-edit-tags
		</button>
		<button
			type="button"
			onClick={() =>
				props.setTags?.((current) => [
					...current,
					{ _id: "t2", book: "Book", chapter: "Two", path: "p1" },
				])
			}
		>
			add-tag-function
		</button>
	</div>
));
jest.mock("../EditContentDialog", () => (props) => (
	<div data-testid="edit-content-dialog" data-open={String(!!props.open)}>
		<button type="button" onClick={props.onClose}>
			close-edit-content
		</button>
		<button type="button" onClick={() => props.setContent?.("Updated body")}>
			set-content
		</button>
	</div>
));
jest.mock("@components/Toolbar", () => ({ registerToolbar: jest.fn() }));

function tagsToJson(path, tags) {
	if (path.endsWith("tags.json")) return JSON.stringify(tags);
	return "{}";
}

describe("Library View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		window.location.hash = "";
		usePathItems.mockReturnValue(["library"]);
		Cookies.get.mockReturnValue("visitor");
		storage.exists.mockResolvedValue(false);
		storage.readFile.mockResolvedValue("{}");
		const state = require("../Store").LibraryStore.__state;
		state.tags = [];
		state.lastViewedArticle = null;
		state.scrollToParagraph = null;
		state.selectedId = null;
	});

	it("renders article component", async () => {
		const { getByTestId } = render(<Library />);
		expect(getByTestId("article")).toBeInTheDocument();
	});

	it("loads tags from storage on mount", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ _id: "1", name: "Tag 1", path: "p1" }]),
		);

		render(<Library />);

		await waitFor(() => {
			expect(storage.readFile).toHaveBeenCalled();
		});
	});

	it("does not show edit controls for a non-admin visitor", async () => {
		Cookies.get.mockReturnValue("visitor");
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(
				tagsToJson(path, [
					{ _id: "t1", book: "Confessions", path: "path-visitor" },
				]),
			),
		);

		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
		});
		expect(screen.queryByTestId("edit-tags-dialog")).not.toBeInTheDocument();
		expect(screen.queryByTestId("edit-content-dialog")).not.toBeInTheDocument();
	});

	describe("as an admin", () => {
		beforeEach(() => {
			Cookies.get.mockReturnValue("admin");
		});

		it("shows edit dialogs for admins once a tag is selected", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(
					tagsToJson(path, [
						{ _id: "t1", book: "Confessions", path: "path-admin-1" },
					]),
				),
			);

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("edit-tags-dialog")).toBeInTheDocument();
			});
			expect(screen.getByTestId("edit-content-dialog")).toBeInTheDocument();
		});

		it("opens the edit tags and edit content dialogs", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(
					tagsToJson(path, [
						{ _id: "t1", book: "Confessions", path: "path-admin-2" },
					]),
				),
			);

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("edit-tags-dialog")).toHaveAttribute(
					"data-open",
					"false",
				);
			});

			fireEvent.click(screen.getByRole("button", { name: "open-edit-tags" }));
			await waitFor(() => {
				expect(screen.getByTestId("edit-tags-dialog")).toHaveAttribute(
					"data-open",
					"true",
				);
			});

			fireEvent.click(
				screen.getByRole("button", { name: "open-edit-content" }),
			);
			await waitFor(() => {
				expect(screen.getByTestId("edit-content-dialog")).toHaveAttribute(
					"data-open",
					"true",
				);
			});
		});

		it("closes edit dialogs and updates content from callbacks", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "path-admin-3" },
						]),
					);
				}
				if (path.endsWith("path-admin-3")) {
					return Promise.resolve(
						JSON.stringify([{ _id: "t1", text: "Original body" }]),
					);
				}
				return Promise.resolve("{}");
			});

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Original body",
				);
			});

			fireEvent.click(screen.getByRole("button", { name: "open-edit-tags" }));
			fireEvent.click(screen.getByRole("button", { name: "close-edit-tags" }));
			await waitFor(() => {
				expect(screen.getByTestId("edit-tags-dialog")).toHaveAttribute(
					"data-open",
					"false",
				);
			});

			fireEvent.click(
				screen.getByRole("button", { name: "open-edit-content" }),
			);
			fireEvent.click(screen.getByRole("button", { name: "set-content" }));
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Updated body",
				);
			});
			fireEvent.click(
				screen.getByRole("button", { name: "close-edit-content" }),
			);
		});
	});

	describe("content loading", () => {
		beforeEach(() => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
		});

		it("loads content for a selected tag from an array file", async () => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "path-array" },
						]),
					);
				}
				if (path.endsWith("path-array")) {
					return Promise.resolve(
						JSON.stringify([{ _id: "t1", text: "Article body" }]),
					);
				}
				return Promise.resolve("{}");
			});

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Article body",
				);
			});
		});

		it("loads content for a selected tag from a single-object file", async () => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "path-solo" },
						]),
					);
				}
				if (path.endsWith("path-solo")) {
					return Promise.resolve(
						JSON.stringify({ _id: "t1", text: "Solo body" }),
					);
				}
				return Promise.resolve("{}");
			});

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Solo body",
				);
			});
		});

		it("shows a not-found message when the item is missing from its file", async () => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "path-missing-item" },
						]),
					);
				}
				if (path.endsWith("path-missing-item")) {
					return Promise.resolve(JSON.stringify({ _id: "other" }));
				}
				return Promise.resolve("{}");
			});

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Content not found in file.",
				);
			});
		});

		it("shows a file-not-found message when the article file does not exist", async () => {
			storage.exists.mockImplementation((path) => {
				if (path.endsWith("tags.json")) return Promise.resolve(true);
				return Promise.resolve(false);
			});
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(
					tagsToJson(path, [
						{ _id: "t1", book: "Confessions", path: "path-file-missing" },
					]),
				),
			);

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"File not found.",
				);
			});
		});

		it("shows an error message when loading content throws", async () => {
			storage.exists.mockImplementation((path) => {
				if (path.endsWith("tags.json")) return Promise.resolve(true);
				return Promise.resolve(true);
			});
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "path-error" },
						]),
					);
				}
				return Promise.resolve("not json{{{");
			});

			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Error loading content.",
				);
			});
		});

		it("reuses cached content for the same file across selections", async () => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", book: "Confessions", path: "shared" },
							{ _id: "t2", book: "Summa", path: "shared" },
						]),
					);
				}
				if (path.endsWith("shared")) {
					return Promise.resolve(
						JSON.stringify([
							{ _id: "t1", text: "First" },
							{ _id: "t2", text: "Second" },
						]),
					);
				}
				return Promise.resolve("{}");
			});

			const { rerender } = render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"First",
				);
			});

			storage.readFile.mockClear();

			usePathItems.mockReturnValue(["library", "id", "t2"]);
			rerender(<Library />);

			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Second",
				);
			});
			expect(
				storage.readFile.mock.calls.some(([p]) => p.endsWith("shared")),
			).toBe(false);
		});
	});

	describe("navigation between articles", () => {
		const tags = [
			{ _id: "t1", book: "Confessions", chapter: "One", path: "p1" },
			{ _id: "t2", book: "Confessions", chapter: "Two", path: "p1" },
			{ _id: "t3", book: "Confessions", chapter: "Three", path: "p1" },
		];

		beforeEach(() => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(tagsToJson(path, tags)),
			);
		});

		it("computes prev/next article names for a middle article", async () => {
			usePathItems.mockReturnValue(["library", "id", "t2"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t2");
			});
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent("One");
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Three",
			);
		});

		it("has no prev article for the first article", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent("");
		});

		it("has no next article for the last article", async () => {
			usePathItems.mockReturnValue(["library", "id", "t3"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t3");
			});
			expect(screen.getByTestId("article-next-name")).toHaveTextContent("");
		});

		it("navigates to the next article and updates the path", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});

			fireEvent.click(screen.getByRole("button", { name: "goto-next" }));

			expect(setPath).toHaveBeenCalledWith("library", "id", "t2");
		});
	});

	describe("URL path matching", () => {
		const tags = [
			{
				_id: "t1",
				author: "Augustine",
				book: "Confessions",
				chapter: "One",
				number: 1,
				path: "p1",
			},
		];

		beforeEach(() => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(tagsToJson(path, tags)),
			);
		});

		it("selects a tag from a hierarchy path without an id", async () => {
			usePathItems.mockReturnValue([
				"library",
				"Augustine",
				"Confessions",
				"One:1",
			]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
		});

		it("resolves a paragraph suffix against the tag base hierarchy", async () => {
			usePathItems.mockReturnValue([
				"library",
				"Augustine",
				"Confessions",
				"One:1:9",
			]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
		});

		it("restores the last viewed article on the root library page", async () => {
			const { LibraryStore } = require("../Store");
			LibraryStore.getRawState.mockReturnValue({
				lastViewedArticle: { _id: "t1" },
			});
			window.location.hash = "#library";
			usePathItems.mockReturnValue(["library"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
		});

		it("does not restore lastViewedArticle when the live URL is a deep link", async () => {
			const { LibraryStore } = require("../Store");
			LibraryStore.getRawState.mockReturnValue({
				lastViewedArticle: { _id: "other" },
			});
			// Stale path items while the address bar points at t1 — select from URL.
			window.location.hash = "#library/id/t1";
			usePathItems.mockReturnValue(["library"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
			expect(setPath).not.toHaveBeenCalled();
		});

		it("selects a deep-linked article from the window hash when path items lag", async () => {
			window.location.hash = "#library/id/5c665fb30551dbb6a6615a92";
			usePathItems.mockReturnValue(["library"]);
			const deepTags = [
				{
					_id: "5c665fb30551dbb6a6615a92",
					book: "Test Book",
					chapter: "One",
					path: "articles/test",
				},
			];
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(JSON.stringify(deepTags));
				}
				if (path.includes("articles/test")) {
					return Promise.resolve(
						JSON.stringify([
							{
								_id: "5c665fb30551dbb6a6615a92",
								text: "Hello from deep link",
							},
						]),
					);
				}
				return Promise.resolve("{}");
			});
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent(
					"5c665fb30551dbb6a6615a92",
				);
			});
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Hello from deep link",
				);
			});
		});

		it("matches article ids coercively when tag ids are non-strings", async () => {
			usePathItems.mockReturnValue(["library", "id", "42"]);
			const numericTags = [
				{ _id: 42, book: "Numbers", chapter: "One", path: "numeric-unique" },
			];
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(JSON.stringify(numericTags));
				}
				return Promise.resolve(
					JSON.stringify([{ _id: 42, text: "Numeric id content" }]),
				);
			});
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("42");
			});
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"Numeric id content",
				);
			});
		});

		it("mirrors LibraryStore.selectedId into the article pane", async () => {
			const { LibraryStore } = require("../Store");
			LibraryStore.__state.tags = [
				{ _id: "store-sel", book: "Book", chapter: "One", path: "path-sel" },
			];
			LibraryStore.__state.selectedId = "store-sel";
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve("[]");
				}
				if (path.includes("path-sel")) {
					return Promise.resolve(
						JSON.stringify([{ _id: "store-sel", text: "From selectedId" }]),
					);
				}
				return Promise.resolve("{}");
			});
			usePathItems.mockReturnValue(["library"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent(
					"store-sel",
				);
			});
			await waitFor(() => {
				expect(screen.getByTestId("article-content")).toHaveTextContent(
					"From selectedId",
				);
			});
		});

		it("handles paragraph suffix on an id path", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1:5"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
			});
		});

		it("selects from LibraryStore tags when the sidebar already loaded them", async () => {
			const { LibraryStore } = require("../Store");
			LibraryStore.__state.tags = [
				{ _id: "store-1", book: "Book", chapter: "One", path: "p1" },
			];
			storage.exists.mockResolvedValue(false);
			usePathItems.mockReturnValue(["library", "id", "store-1"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent(
					"store-1",
				);
			});
		});

		it("navigates to the previous article", async () => {
			usePathItems.mockReturnValue(["library", "id", "t2"]);
			const navTags = [
				{ _id: "t1", book: "Confessions", chapter: "One", path: "p1" },
				{ _id: "t2", book: "Confessions", chapter: "Two", path: "p1" },
			];
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(tagsToJson(path, navTags)),
			);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article-selected")).toHaveTextContent("t2");
			});
			fireEvent.click(screen.getByRole("button", { name: "goto-prev" }));
			expect(setPath).toHaveBeenCalledWith("library", "id", "t1");
		});

		it("ignores unknown hierarchy paths", async () => {
			usePathItems.mockReturnValue(["library", "Nobody", "Nowhere"]);
			render(<Library />);
			await waitFor(() => {
				expect(screen.getByTestId("article")).toBeInTheDocument();
			});
			expect(screen.getByTestId("article-selected")).toHaveTextContent("");
		});
	});

	it("reloads tags when libraryUpdateCounter changes", async () => {
		const { SyncActiveStore } = require("@sync/syncState");
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ libraryUpdateCounter: 0 }),
		);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ _id: "1", name: "Tag 1", path: "p1" }]),
		);
		const { rerender } = render(<Library />);
		await waitFor(() => {
			expect(storage.readFile).toHaveBeenCalled();
		});
		storage.readFile.mockClear();
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ libraryUpdateCounter: 2 }),
		);
		rerender(<Library />);
		await waitFor(() => {
			expect(storage.readFile).toHaveBeenCalled();
		});
	});

	it("logs an error when loading tags fails", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockRejectedValue(new Error("tags read failed"));
		render(<Library />);
		await waitFor(() => {
			expect(logger.error).toHaveBeenCalledWith(
				"Failed to load library tags:",
				expect.any(Error),
			);
		});
	});

	it("loads custom order and applies case-insensitive sorting", async () => {
		const tags = [
			{ _id: "t1", book: "Beta", chapter: "Two", path: "p1" },
			{ _id: "t2", book: "Beta", chapter: "One", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (path.endsWith("library-order.json")) {
				return Promise.resolve(JSON.stringify({ one: 0, TWO: 1 }));
			}
			return Promise.resolve(tagsToJson(path, tags));
		});
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent("Two");
		});
	});

	it("sorts articles by explicit order fields", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Second", order: 2, path: "p1" },
			{ _id: "t2", book: "Book", chapter: "First", order: 1, path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Second",
			);
		});
	});

	it("sorts articles by tag number and subNumber", async () => {
		const tags = [
			{
				_id: "t1",
				book: "Book",
				chapter: "A",
				number: 1,
				subNumber: 2,
				path: "p1",
			},
			{
				_id: "t2",
				book: "Book",
				chapter: "B",
				number: 1,
				subNumber: 1,
				path: "p1",
			},
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent("A");
		});
	});

	it("sorts articles using extracted word numbers in titles", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Chapter Two", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Chapter One", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Chapter Two",
			);
		});
	});

	it("prioritizes table of contents before numbered chapters", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Chapter 1", path: "p1" },
			{
				_id: "t2",
				book: "Book",
				chapter: "Table of Contents",
				path: "p1",
			},
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Chapter 1",
			);
		});
	});

	it("matches paragraph urls against tag base hierarchy", async () => {
		const tags = [
			{
				_id: "t1",
				author: "Augustine",
				book: "Confessions",
				chapter: "One",
				number: 9,
				path: "p1",
			},
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue([
			"library",
			"Augustine",
			"Confessions",
			"One:33",
		]);
		const { LibraryStore } = require("../Store");
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
		});
		expect(LibraryStore.update).toHaveBeenCalled();
	});

	it("updates scrollToParagraph when the same tag is already selected", async () => {
		const { LibraryStore } = require("../Store");
		const tags = [{ _id: "t1", book: "Book", chapter: "One", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t1:5"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
		});
		expect(LibraryStore.update).toHaveBeenCalled();
	});

	it("stores tags in LibraryStore after loading", async () => {
		const { LibraryStore } = require("../Store");
		const tags = [{ _id: "t1", book: "Book", chapter: "One", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		render(<Library />);
		await waitFor(() => {
			expect(LibraryStore.update).toHaveBeenCalled();
		});
	});

	it("sorts articles with only one subNumber defined", async () => {
		const tags = [
			{
				_id: "t1",
				book: "Book",
				chapter: "A",
				number: 2,
				subNumber: 1,
				path: "p1",
			},
			{
				_id: "t2",
				book: "Book",
				chapter: "B",
				number: 1,
				path: "p1",
			},
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent("A");
		});
	});

	it("sorts early-position numeric chapter titles", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "2 Basics", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "1 Basics", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"2 Basics",
			);
		});
	});

	it("restores last viewed article and updates LibraryStore on select", async () => {
		const { LibraryStore } = require("../Store");
		LibraryStore.getRawState.mockReturnValue({
			lastViewedArticle: { _id: "t1" },
		});
		const tags = [{ _id: "t1", book: "Book", chapter: "One", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library"]);
		render(<Library />);
		await waitFor(() => {
			expect(LibraryStore.update).toHaveBeenCalled();
		});
	});

	it("sets scrollToParagraph when selecting a tag from an id url", async () => {
		const { LibraryStore } = require("../Store");
		const tags = [{ _id: "t1", book: "Book", chapter: "One", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t1:12"]);
		render(<Library />);
		await waitFor(() => {
			expect(LibraryStore.update).toHaveBeenCalled();
		});
	});

	it("returns an empty article title when no tag fields are set", async () => {
		const tags = [{ _id: "t1", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent("");
		});
	});

	it("sorts same-base titles by trailing number then falls back to localeCompare", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Lesson 10", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Lesson 2", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "Alpha", path: "p1" },
			{ _id: "t4", book: "Book", chapter: "Beta", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Lesson 10",
			);
		});
	});

	it("appends tag number to hierarchy when present", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Intro", number: 3, path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "Book|Intro:3"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
		});
	});

	it("sorts editor notes before introductions and prefaces", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Preface", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Editor's notes", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "Introduction", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Introduction",
			);
		});
	});

	it("sorts chapters using word numbers in titles", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Chapter third", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Chapter first", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Chapter third",
			);
		});
	});

	it("uses custom order map with case-insensitive keys", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Beta", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "alpha", path: "p1" },
		];
		storage.exists.mockImplementation(async (path) => true);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("order.json")) {
				return JSON.stringify({ Alpha: 1, Beta: 2 });
			}
			return tagsToJson(path, tags);
		});
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent(
				"alpha",
			);
		});
	});

	it("keeps loading state when re-selecting the same tag", async () => {
		const tags = [{ _id: "t1", book: "Book", chapter: "One", path: "p1" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-selected")).toHaveTextContent("t1");
		});
		fireEvent.click(screen.getByRole("button", { name: "goto-next" }));
		await waitFor(() => {
			expect(screen.getByTestId("article-loading")).toHaveTextContent("false");
		});
	});

	it("stores an empty tag list when tags.json is not an array", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (path.endsWith("tags.json")) {
				return Promise.resolve(JSON.stringify({ invalid: true }));
			}
			return Promise.resolve("{}");
		});
		const { LibraryStore } = require("../Store");
		render(<Library />);
		await waitFor(() => {
			expect(LibraryStore.update).toHaveBeenCalled();
		});
	});

	it("sorts foreword and prologue before generic chapters", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Prologue", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Foreword", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "Contents", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Prologue",
			);
		});
	});

	it("sorts chapters that only have a custom order on one side", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Later", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Earlier", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("library-order.json")) {
				return JSON.stringify({ Earlier: 0 });
			}
			return tagsToJson(path, tags);
		});
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent(
				"Earlier",
			);
		});
	});

	it("sorts chapters when only one item has an explicit order field", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Unordered", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Ordered", order: 1, path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent(
				"Ordered",
			);
		});
	});

	it("sorts numbered chapters before plain titles when only one has a number", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Plain", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "2 Numbered", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-next-name")).toHaveTextContent(
				"Plain",
			);
		});
	});

	it("sorts equal-base early-position numbers by title length", async () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "1 Short", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "1 Much Longer Title", path: "p1" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, tags)),
		);
		usePathItems.mockReturnValue(["library", "id", "t2"]);
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("article-prev-name")).toHaveTextContent(
				"1 Short",
			);
		});
	});

	it("updates tags through a functional setTags callback", async () => {
		Cookies.get.mockReturnValue("admin");
		usePathItems.mockReturnValue(["library", "id", "t1"]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(
				tagsToJson(path, [
					{ _id: "t1", book: "Book", chapter: "One", path: "p1" },
				]),
			),
		);
		const { LibraryStore } = require("../Store");
		render(<Library />);
		await waitFor(() => {
			expect(screen.getByTestId("edit-tags-dialog")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: "add-tag-function" }));
		await waitFor(() => {
			expect(LibraryStore.update).toHaveBeenCalled();
		});
	});
});
