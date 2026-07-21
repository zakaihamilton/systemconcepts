import { SyncActiveStore } from "@sync/syncState";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import { setPath, usePathItems } from "@util/domain/views";
import storage from "@util/storage/storage";
import { LibraryStore } from "@views/Library/Store";
import LibraryTree from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({
	setPath: jest.fn(),
	usePathItems: jest.fn(),
}));
jest.mock("@util/storage/storage");
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@views/Library/Store", () => ({
	LibraryStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@views/Library/TreeItem", () => ({ node, onSelect, onToggle }) => (
	<div data-testid={`tree-item-${node.id}`}>
		<span>{node.name}</span>
		<button type="button" onClick={() => onSelect(node)}>
			select-{node.name}
		</button>
		<button type="button" onClick={() => onToggle(node.id, true)}>
			expand-{node.id}
		</button>
		<button type="button" onClick={() => onToggle(node.id, false)}>
			collapse-{node.id}
		</button>
	</div>
));

function tagsToJson(path, tags) {
	if (path.endsWith("tags.json")) return JSON.stringify(tags);
	return "{}";
}

describe("LibraryTree Component", () => {
	let libraryState;

	beforeEach(() => {
		jest.clearAllMocks();
		libraryState = {
			scrollToPath: null,
			expandedNodes: [],
		};
		useTranslations.mockReturnValue({
			FILTER_TAGS: "Filter tags...",
			CLEAR_FILTER: "Clear filter",
		});
		usePathItems.mockReturnValue(["library"]);
		SyncActiveStore.useState.mockReturnValue(0);
		LibraryStore.useState.mockImplementation((selector) =>
			selector ? selector(libraryState) : libraryState,
		);
		LibraryStore.update.mockImplementation((updater) => updater(libraryState));
		storage.exists.mockResolvedValue(false);
		storage.readFile.mockResolvedValue("{}");
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const renderTree = (props) => render(<LibraryTree {...props} />);

	it("renders nothing when there are no tags", () => {
		const { container } = renderTree();
		expect(container).toBeEmptyDOMElement();
	});

	it("loads tags and custom order from storage, builds tree", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (path.endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([
						{ _id: "t1", author: "Augustine", book: "Confessions" },
						{ _id: "t2", author: "Aquinas", book: "Summa" },
					]),
				);
			}
			if (path.endsWith("library-order.json")) {
				return Promise.resolve(JSON.stringify({ Aquinas: 1, Augustine: 2 }));
			}
			return Promise.resolve("{}");
		});

		renderTree();

		await waitFor(() => {
			expect(screen.getByText("Augustine")).toBeInTheDocument();
		});
		expect(screen.getByText("Aquinas")).toBeInTheDocument();
	});

	it("logs an error when loading tags fails", async () => {
		storage.exists.mockRejectedValue(new Error("boom"));
		renderTree();
		await waitFor(() => {
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"Failed to load library tags:",
				expect.any(Error),
			);
		});
	});

	it("logs an error when loading custom order fails", async () => {
		storage.exists.mockImplementation((path) => {
			if (path.endsWith("tags.json")) return Promise.resolve(true);
			return Promise.reject(new Error("order failure"));
		});
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ _id: "t1", author: "Augustine" }]),
		);
		renderTree();
		await waitFor(() => {
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"Failed to load library order:",
				expect.any(Error),
			);
		});
	});

	it("reloads tags and order when libraryUpdateCounter increments", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			Promise.resolve(tagsToJson(path, [{ _id: "t1", author: "Augustine" }])),
		);
		SyncActiveStore.useState.mockReturnValue(1);
		renderTree();
		await waitFor(() => {
			expect(storage.readFile).toHaveBeenCalled();
		});
	});

	describe("selection and interaction (flat tree)", () => {
		const flatTags = [
			{ _id: "t1", book: "Confessions" },
			{ _id: "t2", book: "Summa" },
		];

		beforeEach(() => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(tagsToJson(path, flatTags)),
			);
		});

		it("filters the tree by debounced search text", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Confessions")).toBeInTheDocument();
			});
			expect(screen.getByText("Summa")).toBeInTheDocument();

			fireEvent.change(screen.getByPlaceholderText("Filter tags..."), {
				target: { value: "summa" },
			});

			await waitFor(
				() => {
					expect(screen.queryByText("Confessions")).not.toBeInTheDocument();
				},
				{ timeout: 2000 },
			);
			expect(screen.getByText("Summa")).toBeInTheDocument();
		});

		it("supports OR grouping in the filter text", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Confessions")).toBeInTheDocument();
			});
			const input = screen.getByPlaceholderText("Filter tags...");

			fireEvent.change(input, { target: { value: "confessions" } });
			await waitFor(
				() => {
					expect(screen.queryByText("Summa")).not.toBeInTheDocument();
				},
				{ timeout: 2000 },
			);

			fireEvent.change(input, { target: { value: "summa or confessions" } });
			await waitFor(
				() => {
					expect(screen.getByText("Summa")).toBeInTheDocument();
				},
				{ timeout: 2000 },
			);
			expect(screen.getByText("Confessions")).toBeInTheDocument();
		});

		it("clears the filter text via the clear button", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Confessions")).toBeInTheDocument();
			});

			const input = screen.getByPlaceholderText("Filter tags...");
			fireEvent.change(input, { target: { value: "summa" } });
			await waitFor(
				() => {
					expect(screen.queryByText("Confessions")).not.toBeInTheDocument();
				},
				{ timeout: 2000 },
			);

			fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
			expect(input.value).toBe("");
		});

		it("selects a leaf node and updates the path", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Summa")).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole("button", { name: "select-Summa" }));

			expect(setPath).toHaveBeenCalledWith("library", "id", "t2");
			expect(libraryState.lastViewedArticle).toEqual(
				expect.objectContaining({ _id: "t2" }),
			);
			expect(libraryState.selectedId).toBe("t2");
		});

		it("closes the drawer on mobile after selecting", async () => {
			const closeDrawer = jest.fn();
			renderTree({ isMobile: true, closeDrawer });
			await waitFor(() => {
				expect(screen.getByText("Summa")).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole("button", { name: "select-Summa" }));
			expect(closeDrawer).toHaveBeenCalled();
		});

		it("does not close the drawer when not mobile", async () => {
			const closeDrawer = jest.fn();
			renderTree({ isMobile: false, closeDrawer });
			await waitFor(() => {
				expect(screen.getByText("Summa")).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole("button", { name: "select-Summa" }));
			expect(closeDrawer).not.toHaveBeenCalled();
		});

		it("expands a node and collapses siblings", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Confessions")).toBeInTheDocument();
			});

			libraryState.expandedNodes = ["Summa"];
			fireEvent.click(
				screen.getByRole("button", { name: "expand-Confessions" }),
			);
			expect(libraryState.expandedNodes).toEqual(["Confessions"]);
		});

		it("collapses a node via onToggle", async () => {
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Confessions")).toBeInTheDocument();
			});
			libraryState.expandedNodes = ["Confessions"];
			fireEvent.click(
				screen.getByRole("button", { name: "collapse-Confessions" }),
			);
			expect(libraryState.expandedNodes).toEqual([]);
		});
	});

	describe("URL path matching (hierarchical tree)", () => {
		const hierarchyTags = [
			{
				_id: "t1",
				author: "Augustine",
				book: "Confessions",
				chapter: "One",
				number: 1,
			},
			{
				_id: "t2",
				author: "Augustine",
				book: "Confessions",
				chapter: "Two",
				number: 2,
			},
			{ _id: "t3", author: "Aquinas", book: "Summa" },
			{
				_id: "t4",
				author: "Augustine",
				book: "Confessions",
				chapter: "Three",
				number: 42,
			},
		];

		beforeEach(() => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(tagsToJson(path, hierarchyTags)),
			);
		});

		it("selects a tag from the URL path by id", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1"]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe("t1");
			});
			expect(libraryState.selectPath).toBe("Augustine|Confessions|One:1");
		});

		it("selects a tag from the URL path with a paragraph suffix", async () => {
			usePathItems.mockReturnValue(["library", "id", "t1:5"]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe("t1");
			});
			expect(libraryState.scrollToParagraph).toBe(5);
		});

		it("selects a tag from a hierarchy path without id", async () => {
			usePathItems.mockReturnValue([
				"library",
				"Augustine",
				"Confessions",
				"One:1",
			]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe("t1");
			});
		});

		it("falls back to matching hierarchy base when a paragraph suffix is appended", async () => {
			usePathItems.mockReturnValue([
				"library",
				"Augustine",
				"Confessions",
				"One:1:7",
			]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe("t1");
			});
			expect(libraryState.scrollToParagraph).toBe(7);
		});

		it("clears selection when no tag matches the URL path", async () => {
			usePathItems.mockReturnValue(["library", "Nonexistent", "Path"]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe(null);
			});
			expect(libraryState.selectPath).toBe(null);
		});

		it("matches a tag by base hierarchy when its own number differs from the requested paragraph", async () => {
			usePathItems.mockReturnValue([
				"library",
				"Augustine",
				"Confessions",
				"Three:7",
			]);
			renderTree();
			await waitFor(() => {
				expect(libraryState.selectedId).toBe("t4");
			});
			expect(libraryState.scrollToParagraph).toBe(7);
		});
	});

	describe("tree sort ordering", () => {
		const getRenderedOrder = async (tags, customOrder) => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) => {
				if (path.endsWith("tags.json")) {
					return Promise.resolve(JSON.stringify(tags));
				}
				if (path.endsWith("library-order.json") && customOrder) {
					return Promise.resolve(JSON.stringify(customOrder));
				}
				return Promise.resolve("{}");
			});
			const { container } = renderTree();
			await waitFor(() => {
				expect(
					container.querySelectorAll('[data-testid^="tree-item-"]').length,
				).toBe(tags.length);
			});
			return Array.from(
				container.querySelectorAll('[data-testid^="tree-item-"] span'),
			).map((el) => el.textContent);
		};

		it("prioritizes keyword-based ordering over alphabetical order", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Foreword" },
				{ _id: "b", book: "Introduction" },
			]);
			expect(order).toEqual(["Introduction", "Foreword"]);
		});

		it("applies custom order case-insensitively before alphabetical order", async () => {
			const order = await getRenderedOrder(
				[
					{ _id: "a", book: "Alpha" },
					{ _id: "b", book: "beta" },
				],
				{ Beta: 1, alpha: 2 },
			);
			expect(order).toEqual(["beta", "Alpha"]);
		});

		it("uses the order field to break ties", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Zulu", order: 1 },
				{ _id: "b", book: "Alpha", order: 2 },
			]);
			expect(order).toEqual(["Zulu", "Alpha"]);
		});

		it("falls back to the item with a valid order field when only one has one", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Zulu" },
				{ _id: "b", book: "Alpha", order: 1 },
			]);
			expect(order).toEqual(["Alpha", "Zulu"]);
		});

		it("uses tag number and subNumber for tie-breaking", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Zulu", number: 1, subNumber: 2 },
				{ _id: "b", book: "Alpha", number: 1, subNumber: 1 },
			]);
			expect(order).toEqual(["Alpha", "Zulu"]);
		});

		it("prefers the item with a tag number when only one has one", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Alpha", number: 1 },
				{ _id: "b", book: "Zulu" },
			]);
			expect(order).toEqual(["Alpha", "Zulu"]);
		});

		it("sorts using extracted digits when base names match", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Chapter 10" },
				{ _id: "b", book: "Chapter 2" },
			]);
			expect(order).toEqual(["Chapter 2", "Chapter 10"]);
		});

		it("sorts using number words when base names match", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Chapter Ten" },
				{ _id: "b", book: "Chapter Two" },
			]);
			expect(order).toEqual(["Chapter Two", "Chapter Ten"]);
		});

		it("prefers an item with an extractable number over one without", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Appendix" },
				{ _id: "b", book: "Chapter 5" },
			]);
			expect(order).toEqual(["Chapter 5", "Appendix"]);
		});

		it("falls back to locale comparison when no numeric information exists", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Zebra" },
				{ _id: "b", book: "Apple" },
			]);
			expect(order).toEqual(["Apple", "Zebra"]);
		});

		it("prioritizes editor notes and table of contents keywords", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Main text" },
				{ _id: "b", book: "Editor's note" },
				{ _id: "c", book: "Table of Contents" },
			]);
			expect(order[0]).toBe("Editor's note");
			expect(order[1]).toBe("Table of Contents");
		});

		it("prefers numbered leaves when only one sibling has a tag number", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Numbered", number: 1, subNumber: 2 },
				{ _id: "b", book: "Plain" },
			]);
			expect(order).toEqual(["Numbered", "Plain"]);
		});

		it("compares leading numbers when both titles start with digits", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "1 First" },
				{ _id: "b", book: "2 Second" },
			]);
			expect(order).toEqual(["1 First", "2 Second"]);
		});

		it("uses subNumber when only one numbered sibling provides it", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Alpha", number: 5, subNumber: 2 },
				{ _id: "b", book: "Beta", number: 5 },
			]);
			expect(order).toEqual(["Alpha", "Beta"]);
		});

		it("sorts short leading-number titles before longer ones", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "10 Long title" },
				{ _id: "b", book: "2 Short" },
			]);
			expect(order[0]).toBe("2 Short");
		});

		it("sorts foreword and prologue ahead of generic books", async () => {
			const order = await getRenderedOrder([
				{ _id: "a", book: "Prologue" },
				{ _id: "b", book: "Foreword" },
				{ _id: "c", book: "Contents" },
			]);
			expect(order).toEqual(["Foreword", "Prologue", "Contents"]);
		});

		it("sorts siblings when only one has a custom order value", async () => {
			const order = await getRenderedOrder(
				[
					{ _id: "a", book: "Later" },
					{ _id: "b", book: "Earlier" },
				],
				{ Earlier: 0 },
			);
			expect(order).toEqual(["Earlier", "Later"]);
		});

		it("skips tags that have no hierarchy levels", async () => {
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockImplementation((path) =>
				Promise.resolve(
					tagsToJson(path, [
						{ _id: "empty", author: "  " },
						{ _id: "t1", book: "Visible" },
					]),
				),
			);
			renderTree();
			await waitFor(() => {
				expect(screen.getByText("Visible")).toBeInTheDocument();
			});
			expect(screen.queryByText("empty")).not.toBeInTheDocument();
		});
	});

	it("reads libraryUpdateCounter from the sync store selector", () => {
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ libraryUpdateCounter: 2 }),
		);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ _id: "t1", author: "Augustine" }]),
		);
		renderTree();
		expect(SyncActiveStore.useState).toHaveBeenCalled();
	});

	it("scrolls to and clears a requested path from the store", () => {
		jest.useFakeTimers();
		libraryState.scrollToPath = "Augustine|Confessions|One:1";
		renderTree();

		expect(libraryState.selectPath).toBe("Augustine|Confessions|One:1");

		jest.advanceTimersByTime(100);
		expect(libraryState.scrollToPath).toBe(null);

		jest.advanceTimersByTime(1000);
		expect(libraryState.selectPath).toBe(null);
	});
});
