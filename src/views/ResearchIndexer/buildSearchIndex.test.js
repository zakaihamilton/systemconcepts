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

	it("indexes year-split groups when merged group file is missing", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const groupsPath = makePath("local/sync/groups.json");
		const yearPath = makePath("local/sync", "study", "2024.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([]),
			[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
			[yearPath]: JSON.stringify({
				sessions: [
					{
						group: "study",
						year: "2024",
						date: "2024-02-02",
						name: "Year File Session",
						summaryText: "Yearfile token alpha",
					},
				],
			}),
		});
		storage.getListing = jest.fn(async (path) => {
			if (path.endsWith("/study") || path.endsWith("study")) {
				return [{ name: "2024.json" }];
			}
			return [];
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.index.f).toContain(
			"session|study|2024|2024-02-02|Year File Session",
		);
		expect(result.index.t.yearfile).toBeDefined();
	});

	it("indexes array article files and summary.path sessions", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/many.json");
		const groupsPath = makePath("local/sync/groups.json");
		const groupPath = makePath("local/sync/study.json");
		const summaryPath = makePath("local/sync", "summaries/s1.txt");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "a1", path: "articles/many.json" },
				{ _id: "a2", path: "articles/many.json" },
				{ _id: "missing", path: "articles/gone.json" },
			]),
			[articlePath]: JSON.stringify([
				{ _id: "a1", text: "Array article zebra" },
				{ _id: "a2", text: "" },
			]),
			[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
			[groupPath]: JSON.stringify({
				sessions: [
					{
						group: "study",
						year: "2024",
						date: "2024-03-03",
						name: "Summary Path",
						summary: { path: "summaries/s1.txt" },
					},
				],
			}),
			[summaryPath]: "Summary path content mango",
		});
		storage.readFile = jest.fn(async (path) => {
			if (path.includes("gone.json")) throw new Error("boom");
			if (!Object.hasOwn(storage._files || {}, path)) {
				// fall through to files map via exists/read pattern
			}
			const files = {
				[tagsPath]: storage.exists.mock ? undefined : undefined,
			};
			void files;
			const map = {
				[tagsPath]: JSON.stringify([
					{ _id: "a1", path: "articles/many.json" },
					{ _id: "a2", path: "articles/many.json" },
					{ _id: "missing", path: "articles/gone.json" },
				]),
				[articlePath]: JSON.stringify([
					{ _id: "a1", text: "Array article zebra" },
					{ _id: "a2", text: "" },
				]),
				[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
				[groupPath]: JSON.stringify({
					sessions: [
						{
							group: "study",
							year: "2024",
							date: "2024-03-03",
							name: "Summary Path",
							summary: { path: "summaries/s1.txt" },
						},
					],
				}),
				[summaryPath]: "Summary path content mango",
			};
			if (!Object.hasOwn(map, path)) throw new Error(`missing ${path}`);
			return map[path];
		});
		storage.exists = jest.fn(async (path) => {
			return (
				path === tagsPath ||
				path === articlePath ||
				path === groupsPath ||
				path === groupPath ||
				path === summaryPath
			);
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.index.f).toEqual(
			expect.arrayContaining([
				"a1",
				"session|study|2024|2024-03-03|Summary Path",
			]),
		);
		expect(result.index.t.zebra).toBeDefined();
		expect(result.index.t.mango).toBeDefined();
	});

	it("logs when groups.json cannot be loaded and still indexes articles", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "Only article content.",
			}),
		});
		storage.exists = jest.fn(async (path) => {
			if (path.includes("groups.json")) return true;
			return Object.hasOwn(
				{
					[tagsPath]: true,
					[articlePath]: true,
				},
				path,
			);
		});
		const originalRead = storage.readFile;
		storage.readFile = jest.fn(async (path) => {
			if (path.includes("groups.json")) throw new Error("groups missing");
			return originalRead(path);
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.index.f).toEqual(["article-1"]);
	});

	it("returns CANCELLED when cancelled after optimize", async () => {
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
		let phase = 0;
		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			isCancelled: () => {
				phase += 1;
				// Allow processPath/session work; cancel on the post-compress check.
				return phase > 5;
			},
			onStatus: (status) => {
				if (status === "Optimizing") {
					phase = 10;
				}
			},
			encodeIndex: jest.fn(),
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("CANCELLED");
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("warns when an article file fails to parse during indexing", async () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/bad.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([{ _id: "bad-1", path: "articles/bad.json" }]),
			[articlePath]: "{not-json",
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("Failed to index file"),
			}),
		);
		warnSpy.mockRestore();
	});

	it("skips short tokens and indexes numeric tokens", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "A 42 ok item.",
			}),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.index.t["42"]).toBeDefined();
		expect(result.index.t.a).toBeUndefined();
	});

	it("returns an empty session list when groups.json is missing", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([]),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.ok).toBe(true);
		expect(result.index.f).toEqual([]);
	});

	it("falls back to year files when merged group json has no sessions key", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const groupsPath = makePath("local/sync/groups.json");
		const mergedPath = makePath("local/sync/study.json");
		const yearPath = makePath("local/sync", "study", "2024.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([]),
			[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
			[mergedPath]: JSON.stringify({ other: true }),
			[yearPath]: JSON.stringify({
				sessions: [
					{
						group: "study",
						year: "2024",
						date: "2024-04-04",
						name: "Fallback Session",
						summaryText: "Fallback token zeta",
					},
				],
			}),
		});
		storage.getListing = jest.fn(async (path) => {
			if (path.endsWith("/study") || path.endsWith("study")) {
				return [{ name: "2024.json" }];
			}
			return [];
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.index.t.zeta).toBeDefined();
	});

	it("uses the default optimizing status when no translation is provided", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/one.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "article-1", path: "articles/one.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "article-1",
				text: "Default optimize status text.",
			}),
		});
		const onStatus = jest.fn();

		await buildSearchIndex({
			storage,
			onStatus,
			translations: { DONE: "Done" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(onStatus).toHaveBeenCalledWith("Optimizing index...");
	});

	it("sanitizes summary paths that contain parent directory segments", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const groupsPath = makePath("local/sync/groups.json");
		const groupPath = makePath("local/sync/study.json");
		const summaryPath = makePath("local/sync", "summaries/safe.txt");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([]),
			[groupsPath]: JSON.stringify({ groups: [{ name: "study" }] }),
			[groupPath]: JSON.stringify({
				sessions: [
					{
						group: "study",
						year: "2024",
						date: "2024-05-05",
						name: "Unsafe Summary",
						summary: { path: "../summaries/safe.txt" },
					},
				],
			}),
			[summaryPath]: "Sanitized summary token",
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.index.t.sanitized).toBeDefined();
	});

	it("indexes a single-object article payload", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/single.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "solo", path: "articles/single.json" },
			]),
			[articlePath]: JSON.stringify({
				_id: "solo",
				text: "Single object article token",
			}),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.index.f).toEqual(["solo"]);
		expect(result.index.t.single).toBeDefined();
	});

	it("skips articles whose text produces no indexable tokens", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const articlePath = makePath(LIBRARY_LOCAL_PATH, "articles/empty.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([
				{ _id: "empty", path: "articles/empty.json" },
			]),
			[articlePath]: JSON.stringify({ _id: "empty", text: "   " }),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.index.f).toEqual([]);
	});

	it("ignores groups.json payloads without a groups array", async () => {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		const groupsPath = makePath("local/sync/groups.json");
		const storage = createMockStorage({
			[tagsPath]: JSON.stringify([]),
			[groupsPath]: JSON.stringify({ other: true }),
		});

		const result = await buildSearchIndex({
			storage,
			translations: { DONE: "Done", OPTIMIZING_INDEX: "Optimizing" },
			encodeIndex: jest.fn((index) => JSON.stringify(index)),
		});

		expect(result.index.f).toEqual([]);
	});
});
