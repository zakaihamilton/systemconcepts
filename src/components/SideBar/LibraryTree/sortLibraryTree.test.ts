import { sortLibraryTags } from "@views/Library/Library/sortLibraryTags";
import { type SortableLibraryNode, sortLibraryTree } from "./sortLibraryTree";

function makeNode(
	name: string,
	extra: Partial<SortableLibraryNode> = {},
): SortableLibraryNode {
	return {
		id: name,
		name,
		children: [],
		...extra,
	};
}

describe("sortLibraryTree and sortLibraryTags", () => {
	it("returns empty array when tags are empty", () => {
		expect(sortLibraryTags([], {})).toEqual([]);
	});

	it("sorts articles by explicit order fields", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Second", order: 2, path: "p1" },
			{ _id: "t2", book: "Book", chapter: "First", order: 1, path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual(["First", "Second"]);
	});

	it("sorts chapters when only one item has an explicit order field", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Unordered", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Ordered", order: 1, path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual(["Ordered", "Unordered"]);
	});

	it("sorts articles by tag number and subNumber", () => {
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
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual(["B", "A"]);
	});

	it("sorts articles with only one subNumber defined", () => {
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
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual(["B", "A"]);

		const sameNumNodes = [
			makeNode("NoSub", { number: 1 }),
			makeNode("WithSub", { number: 1, subNumber: 2 }),
		];
		expect(sortLibraryTree(sameNumNodes).map((n) => n.name)).toEqual([
			"WithSub",
			"NoSub",
		]);
	});

	it("sorts articles using extracted word numbers in titles", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Chapter Two", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Chapter One", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual([
			"Chapter One",
			"Chapter Two",
		]);
	});

	it("sorts chapters using ordinal word numbers in titles", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Chapter third", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Chapter first", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual([
			"Chapter first",
			"Chapter third",
		]);
	});

	it("prioritizes editor notes, introductions, prefaces, forewords, prologues, and contents", () => {
		const tags = [
			{ _id: "t5", book: "Book", chapter: "Chapter 1", path: "p1" },
			{ _id: "t4", book: "Book", chapter: "Table of Contents", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "Prologue", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Foreword", path: "p1" },
			{ _id: "t1", book: "Book", chapter: "Preface", path: "p1" },
			{ _id: "t0", book: "Book", chapter: "Introduction", path: "p1" },
			{ _id: "t-1", book: "Book", chapter: "Editor's notes", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual([
			"Editor's notes",
			"Introduction",
			"Preface",
			"Foreword",
			"Prologue",
			"Table of Contents",
			"Chapter 1",
		]);
	});

	it("sorts early-position numeric chapter titles and equal-base lengths", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "2 Basics", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "1 Much Longer Title", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "1 Short", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual([
			"1 Short",
			"1 Much Longer Title",
			"2 Basics",
		]);
	});

	it("sorts same-base titles by trailing number then falls back to localeCompare", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Lesson 10", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "Lesson 2", path: "p1" },
			{ _id: "t3", book: "Book", chapter: "Beta", path: "p1" },
			{ _id: "t4", book: "Book", chapter: "Alpha", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual([
			"Lesson 2",
			"Lesson 10",
			"Alpha",
			"Beta",
		]);
	});

	it("sorts numbered chapters before plain titles when only one has a number", () => {
		const tags = [
			{ _id: "t1", book: "Book", chapter: "Plain", path: "p1" },
			{ _id: "t2", book: "Book", chapter: "2 Numbered", path: "p1" },
		];
		const sorted = sortLibraryTags(tags, {});
		expect(sorted.map((t: any) => t.chapter)).toEqual(["2 Numbered", "Plain"]);
	});

	it("uses custom order map with case-insensitive keys and one-sided custom order", () => {
		const nodes = [makeNode("Beta"), makeNode("alpha")];
		expect(
			sortLibraryTree(nodes, { Alpha: 1, Beta: 2 }).map((n) => n.name),
		).toEqual(["alpha", "Beta"]);

		const oneSided = [makeNode("Later"), makeNode("Earlier")];
		expect(
			sortLibraryTree(oneSided, { Earlier: 0 }).map((n) => n.name),
		).toEqual(["Earlier", "Later"]);
	});

	it("recursively sorts child nodes", () => {
		const root = [
			makeNode("Book", {
				children: [makeNode("Chapter 2"), makeNode("Chapter 1")],
			}),
		];
		sortLibraryTree(root);
		expect(root[0].children.map((c) => c.name)).toEqual([
			"Chapter 1",
			"Chapter 2",
		]);
	});
});
