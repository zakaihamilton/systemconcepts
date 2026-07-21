import { getLibrarySection } from "./Section";
import { LibraryStore } from "./Store";

jest.mock("./Store", () => ({
	LibraryStore: {
		getRawState: jest.fn(),
	},
}));

describe("getLibrarySection", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		LibraryStore.getRawState.mockReturnValue({ tags: [] });
	});

	it("returns a capitalized root Library section", () => {
		const section = getLibrarySection({
			id: "library",
			path: "library",
			translations: { LIBRARY: "library" },
		});
		expect(section.name).toBe("Library");
		expect(section.label).toBe("Library");
		expect(section.Icon).toBeTruthy();
		expect(section.icon).toBeTruthy();
	});

	it("uses Library fallback when translation is missing", () => {
		const section = getLibrarySection({
			id: "Library",
			path: "",
			translations: {},
		});
		expect(section.label).toBe("Library");
	});

	it("returns null for the id path segment", () => {
		expect(
			getLibrarySection({
				id: "id",
				path: "library/id",
				translations: {},
			}),
		).toBeNull();
	});

	it("resolves a tag by _id and appends number", () => {
		LibraryStore.getRawState.mockReturnValue({
			tags: [
				{
					_id: "tag-1",
					author: "Augustine",
					book: "Confessions",
					title: "Grace",
					number: 3,
				},
			],
		});
		const section = getLibrarySection({
			id: "tag-1",
			path: "library/id/tag-1",
			translations: {},
		});
		expect(section.label).toBe("Grace:3");
		expect(section.description).toBe("Title");
		expect(section.static).toBe(true);
		expect(section.Icon).toBeTruthy();
	});

	it("resolves a field-value path segment preferring earlier fields", () => {
		LibraryStore.getRawState.mockReturnValue({
			tags: [
				{
					_id: "t1",
					author: "Augustine",
					book: "Confessions",
					chapter: "One",
				},
			],
		});
		const section = getLibrarySection({
			id: "Confessions",
			path: "library/Augustine/Confessions",
			translations: {},
		});
		expect(section.label).toBe("Confessions");
		expect(section.description).toBe("Book");
		expect(section.Icon).toBeTruthy();
	});

	it("strips description prefix from the label when present", () => {
		LibraryStore.getRawState.mockReturnValue({
			tags: [{ _id: "t1", book: "Book Confessions" }],
		});
		const section = getLibrarySection({
			id: "Book Confessions",
			path: "library/Book%20Confessions",
			translations: {},
		});
		expect(section.label).toBe("Confessions");
		expect(section.description).toBe("Book");
	});

	it("keeps original label when stripping description leaves nothing", () => {
		LibraryStore.getRawState.mockReturnValue({
			tags: [{ _id: "t1", book: "Book" }],
		});
		const section = getLibrarySection({
			id: "Book",
			path: "library/Book",
			translations: {},
		});
		expect(section.label).toBe("Book");
	});

	it("strips numeric colon suffixes from labels", () => {
		LibraryStore.getRawState.mockReturnValue({ tags: [] });
		const section = getLibrarySection({
			id: "Chapter One:12",
			path: "library/Chapter%20One:12",
			translations: {},
		});
		expect(section.label).toBe("Chapter One");
	});

	it("decodes path segments when id is empty", () => {
		LibraryStore.getRawState.mockReturnValue({ tags: [] });
		const section = getLibrarySection({
			id: "",
			path: "library/Some%20Name",
			translations: {},
		});
		expect(section.name).toBe("Some Name");
	});

	it("returns null Icon when no matching tag field is found", () => {
		LibraryStore.getRawState.mockReturnValue({ tags: [] });
		const section = getLibrarySection({
			id: "Unknown",
			path: "library/Unknown",
			translations: {},
		});
		expect(section.Icon).toBeNull();
		expect(section.icon).toBeNull();
		expect(section.static).toBe(true);
	});

	it("returns null when a tag id has no displayable fields", () => {
		LibraryStore.getRawState.mockReturnValue({
			tags: [{ _id: "empty-tag" }],
		});
		const section = getLibrarySection({
			id: "empty-tag",
			path: "library/id/empty-tag",
			translations: {},
		});
		expect(section.label).toBe("empty-tag");
		expect(section.Icon).toBeNull();
		expect(section.icon).toBeNull();
	});

	it("uses the last path segment when id is omitted", () => {
		LibraryStore.getRawState.mockReturnValue({ tags: [] });
		const section = getLibrarySection({
			id: "",
			path: "library/alpha/beta",
			translations: {},
		});
		expect(section.name).toBe("beta");
	});

	it("keeps the root label when translation is an empty string", () => {
		const section = getLibrarySection({
			id: "library",
			path: "library",
			translations: { LIBRARY: "" },
		});
		expect(section.label).toBe("Library");
	});
});
