import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/data/path";
import { buildSearchIndex, INDEX_FILE, STOP_WORDS } from "./buildSearchIndex";

function createMockStorage(files = {}) {
	return {
		exists: jest.fn(async (path) => Object.hasOwn(files, path)),
		readFile: jest.fn(async (path) => {
			if (!Object.hasOwn(files, path)) throw new Error(`missing ${path}`);
			return files[path];
		}),
		writeFile: jest.fn(async (path, data) => {
			files[path] = data;
		}),
		createFolderPath: jest.fn(async () => {}),
		getListing: jest.fn(async () => []),
	};
}

describe("buildSearchIndex", () => {
	it("fails when tags.json is missing", async () => {
		const storage = createMockStorage();
		const onStatus = jest.fn();
		const result = await buildSearchIndex({
			storage,
			translations: { NO_TAGS_FOUND: "No tags" },
			onStatus,
		});
		expect(result).toEqual({ ok: false, reason: "NO_TAGS_FOUND" });
		expect(onStatus).toHaveBeenCalledWith("No tags");
	});

	it("builds a v5 index for articles and sessions, skipping stop words", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const groupsPath = makePath("local/sync/groups.json");
		const groupPath = makePath("local/sync/study.json");
		const files = {
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json", title: "One" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "The graceful concept appears here.",
			}),
			[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
			[groupPath]: JSON.stringify({
				sessions: [
					{
						group: "study",
						year: "2024",
						date: "2024-01-01",
						name: "Opening Session",
						description: "intro",
						summaryText: "Discussing luminous ideas carefully.",
					},
				],
			}),
		};
		const storage = createMockStorage(files);
		const encodeIndex = jest.fn((index) => `binary:${JSON.stringify(index)}`);
		const onProgress = jest.fn();

		const result = await buildSearchIndex({
			storage,
			translations: {
				LOADING_TAGS: "Loading",
				OPTIMIZING_INDEX: "Optimizing",
				DONE: "Done",
			},
			encodeIndex,
			onProgress,
		});

		expect(result.ok).toBe(true);
		expect(result.index.v).toBe(5);
		expect(result.index.f).toHaveLength(2);
		expect(result.index.f).toEqual(
			expect.arrayContaining([
				"article-1",
				"session|study|2024|2024-01-01|Opening Session",
			]),
		);
		const articleIndex = result.index.f.indexOf("article-1");
		const sessionIndex = result.index.f.indexOf(
			"session|study|2024|2024-01-01|Opening Session",
		);
		expect(result.index.t.graceful).toEqual([-(articleIndex + 1), 0]);
		expect(result.index.t.concept).toEqual([-(articleIndex + 1), 0]);
		expect(result.index.t.luminous[0]).toBe(-(sessionIndex + 1));
		expect(result.index.t.luminous.length).toBeGreaterThan(1);
		expect(result.index.t.the).toBeUndefined();
		expect(STOP_WORDS.has("the")).toBe(true);

		const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
		expect(storage.writeFile).toHaveBeenCalledWith(
			indexPath,
			expect.stringContaining('"v":5'),
		);
		expect(encodeIndex).toHaveBeenCalledWith(result.index);
		expect(onProgress).toHaveBeenCalled();
	});

	it("returns CANCELLED when cancelled before write", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "Meaningful content here.",
			}),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done" },
			isCancelled: () => true,
			encodeIndex: jest.fn(),
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("CANCELLED");
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("skips write when cancelled after createFolderPath", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "Meaningful content here.",
			}),
		});
		let cancel = false;
		storage.createFolderPath = jest.fn(async () => {
			cancel = true;
		});
		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			isCancelled: () => cancel,
			encodeIndex: jest.fn(),
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("CANCELLED");
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("reports success with cancelledAfterWrite if cancelled after persist", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "Meaningful content here.",
			}),
		});
		let cancel = false;
		storage.writeFile = jest.fn(async () => {
			cancel = true;
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			isCancelled: () => cancel,
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.cancelledAfterWrite).toBe(true);
		expect(storage.writeFile).toHaveBeenCalled();
	});
});
