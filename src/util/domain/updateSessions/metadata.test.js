import { logger } from "@util/api/logger";
import { readBinary } from "@util/data/binary";
import storage from "@util/storage/storage";
import JSZip from "jszip";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

jest.mock("@util/data/binary", () => ({
	readBinary: jest.fn(),
}));

jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	readFile: jest.fn(),
}));

const YEAR = { name: "2024" };
const PATH = "/aws/sessions/test";

describe("update session metadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("loadTags", () => {
		it("loads tags from bundle.json when the group is bundled", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/bundle.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/bundle.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "test_2024-05-05 Test Session",
								name: "2024-05-05 Test Session",
								tags: ["ai."],
							},
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, false, false, true);

			expect(tags["2024-05-05 Test Session"]).toEqual(["ai"]);
			expect(storage.readFile).not.toHaveBeenCalledWith(
				expect.stringContaining(".tags"),
			);
		});

		it("falls back to the merged group file when not bundled", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/test.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/test.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "id1",
								name: "2024-05-05 Test Session",
								tags: ["merged"],
							},
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, false, true, false);

			expect(tags["2024-05-05 Test Session"]).toEqual(["merged"]);
		});

		it("falls back to the local year file when no merged/bundled cache matches", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/test/2024.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/test/2024.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "id1",
								name: "2024-05-05 Test Session",
								tags: ["year-cache"],
							},
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, false, false, false);

			expect(tags["2024-05-05 Test Session"]).toEqual(["year-cache"]);
		});

		it("reads the remote .tags file when nothing is cached locally", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.tags`,
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === `${PATH}/2024.tags`) {
					return JSON.stringify({
						sessions: [
							{ sessionName: "2024-05-05 Test Session", tags: ["remote"] },
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, false, false, false);

			expect(tags["2024-05-05 Test Session"]).toEqual(["remote"]);
		});

		it("skips cache lookups entirely when forceUpdate is true", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.tags`,
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === `${PATH}/2024.tags`) {
					return JSON.stringify({
						sessions: [
							{ sessionName: "2024-05-05 Test Session", tags: ["forced"] },
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, true, true, true);

			expect(storage.exists).not.toHaveBeenCalledWith(
				"/local/sync/bundle.json",
			);
			expect(tags["2024-05-05 Test Session"]).toEqual(["forced"]);
		});

		it("returns an empty map when the remote tags file does not exist", async () => {
			storage.exists.mockResolvedValue(false);
			storage.readFile.mockResolvedValue("");

			const tags = await loadTags(YEAR, "test", PATH, false, false, false);

			expect(tags).toEqual({});
		});

		it("throws and logs an error when reading the remote tags file fails", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.tags`,
			);
			storage.readFile.mockRejectedValue(new Error("read failed"));

			await expect(
				loadTags(YEAR, "test", PATH, false, false, false),
			).rejects.toThrow("read failed");
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Error reading tags file"),
				expect.any(Error),
			);
		});

		it("logs a warning and continues when the cache lookup throws", async () => {
			storage.exists.mockImplementation(async (path) => {
				if (path === "/local/sync/bundle.json") {
					throw new Error("exists failed");
				}
				return path === `${PATH}/2024.tags`;
			});
			storage.readFile.mockImplementation(async (path) => {
				if (path === `${PATH}/2024.tags`) {
					return JSON.stringify({
						sessions: [
							{ sessionName: "2024-05-05 Test Session", tags: ["fallback"] },
						],
					});
				}
				return "";
			});

			const tags = await loadTags(YEAR, "test", PATH, false, false, true);

			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Failed to read cache"),
				expect.any(Error),
			);
			expect(tags["2024-05-05 Test Session"]).toEqual(["fallback"]);
		});
	});

	describe("loadDurations", () => {
		it("reads the remote .duration file when nothing is cached", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.duration`,
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === `${PATH}/2024.duration`) {
					return JSON.stringify({
						sessions: [
							{ sessionName: "2024-05-05 Test Session", duration: 321 },
						],
					});
				}
				return "";
			});

			const durations = await loadDurations(
				YEAR,
				"test",
				PATH,
				false,
				false,
				false,
			);

			expect(durations["2024-05-05 Test Session"]).toBe(321);
		});

		it("uses cached durations from the merged file without hitting remote", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/test.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/test.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "id1",
								name: "2024-05-05 Test Session",
								duration: 111,
							},
						],
					});
				}
				return "";
			});

			const durations = await loadDurations(
				YEAR,
				"test",
				PATH,
				false,
				true,
				false,
			);

			expect(durations["2024-05-05 Test Session"]).toBe(111);
			expect(storage.readFile).not.toHaveBeenCalledWith(
				expect.stringContaining(".duration"),
			);
		});
	});

	describe("loadSummaries", () => {
		it("loads cached summaries from bundle.json", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/bundle.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/bundle.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "id1",
								name: "2024-05-05 Test Session",
								summaryText: "Cached summary",
							},
						],
					});
				}
				return "";
			});

			const summaries = await loadSummaries(
				YEAR,
				"test",
				PATH,
				false,
				false,
				true,
			);

			expect(summaries["2024-05-05 Test Session"]).toBe("Cached summary");
		});

		it("reads the remote markdown file when nothing is cached", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.md`,
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === `${PATH}/2024.md`) {
					return "## 2024-05-05 Test Session\nRemote summary\n---\n";
				}
				return "";
			});

			const summaries = await loadSummaries(
				YEAR,
				"test",
				PATH,
				false,
				false,
				false,
			);

			expect(summaries["2024-05-05 Test Session"]).toBe("Remote summary");
		});

		it("returns an empty object when the remote markdown file is missing", async () => {
			storage.exists.mockResolvedValue(false);

			const summaries = await loadSummaries(
				YEAR,
				"test",
				PATH,
				false,
				false,
				false,
			);

			expect(summaries).toEqual({});
		});

		it("throws and logs an error when reading the remote markdown file fails", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.md`,
			);
			storage.readFile.mockRejectedValue(new Error("md read failed"));

			await expect(
				loadSummaries(YEAR, "test", PATH, false, false, false),
			).rejects.toThrow("md read failed");
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Error reading summaryText file"),
				expect.any(Error),
			);
		});
	});

	describe("loadTranscriptions", () => {
		it("loads transcription zip entries by session id when the zip contains folders", async () => {
			const zip = new JSZip();
			zip.file(
				"Transcriptions/2024-05-05 Test Session.TXT",
				"Transcript content",
			);
			zip.file("__MACOSX/Transcriptions/._2024-05-05 Test Session.TXT", "");

			const blob = await zip.generateAsync({ type: "blob" });

			storage.exists.mockResolvedValue(true);
			readBinary.mockResolvedValue(blob);

			const transcriptions = await loadTranscriptions(
				{ name: "2024" },
				"test",
				"/aws/sessions/test",
				true,
				false,
				false,
			);

			expect(transcriptions["2024-05-05 Test Session"]).toBe(true);
			expect(
				transcriptions["Transcriptions/2024-05-05 Test Session.TXT"],
			).toBeUndefined();
			expect(transcriptions["._2024-05-05 Test Session"]).toBeUndefined();
		});

		it("loads cached transcription flags from the bundle file", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/bundle.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/bundle.json") {
					return JSON.stringify({
						sessions: [
							{
								id: "id1",
								name: "2024-05-05 Test Session",
								transcription: true,
							},
						],
					});
				}
				return "";
			});

			const transcriptions = await loadTranscriptions(
				YEAR,
				"test",
				PATH,
				false,
				false,
				true,
			);

			expect(transcriptions["2024-05-05 Test Session"]).toBe(true);
			expect(readBinary).not.toHaveBeenCalled();
		});

		it("returns an empty object when the remote zip file does not exist", async () => {
			storage.exists.mockResolvedValue(false);

			const transcriptions = await loadTranscriptions(
				YEAR,
				"test",
				PATH,
				false,
				false,
				false,
			);

			expect(transcriptions).toEqual({});
		});

		it("swallows errors reading the remote zip file without throwing", async () => {
			storage.exists.mockImplementation(
				async (path) => path === `${PATH}/2024.zip`,
			);
			readBinary.mockRejectedValue(new Error("zip read failed"));

			const transcriptions = await loadTranscriptions(
				YEAR,
				"test",
				PATH,
				true,
				false,
				false,
			);

			expect(transcriptions).toEqual({});
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Error reading transcription file"),
				expect.any(Error),
			);
		});

		it("ignores a null zip blob and empty zip entries", async () => {
			storage.exists.mockResolvedValue(true);
			readBinary.mockResolvedValue(null);
			const transcriptions = await loadTranscriptions(
				YEAR,
				"test",
				PATH,
				true,
				false,
				false,
			);
			expect(transcriptions).toEqual({});
		});
	});

	it("ignores empty tag arrays and sessions without matching year prefixes", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/bundle.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{ id: "1", name: "2023-01-01 Old", tags: [] },
					{ id: "2", name: null, tags: ["x"] },
					{ id: "3", tags: ["y"] },
					{ id: "4", name: "2024-01-01 Ok", tags: ["keep"] },
				],
			}),
		);

		const tags = await loadTags(YEAR, "test", PATH, false, false, true);
		expect(tags["2024-01-01 Ok"]).toEqual(["keep"]);
		expect(tags["2023-01-01 Old"]).toBeUndefined();
	});

	it("loads summaries from the year file when merged cache is incomplete", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/sync/test.json") return true;
			if (path === "/local/sync/test/2024.json") return true;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/test.json") {
				return JSON.stringify({ sessions: [{ id: "1", name: "nope" }] });
			}
			if (path === "/local/sync/test/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2",
							name: "2024-05-05 Test Session",
							summaryText: "Year summary",
						},
					],
				});
			}
			return "";
		});

		const summaries = await loadSummaries(
			YEAR,
			"test",
			PATH,
			false,
			true,
			false,
		);
		expect(summaries["2024-05-05 Test Session"]).toBe("Year summary");
	});

	it("maps tags by session id when the cached session has no name", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/bundle.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						id: "2024-05-05 Test Session",
						tags: ["id-only"],
					},
				],
			}),
		);

		const tags = await loadTags(YEAR, "test", PATH, false, false, true);
		expect(tags["2024-05-05 Test Session"]).toEqual(["id-only"]);
	});

	it("ignores empty duration values when loading from cache", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/bundle.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						id: "id1",
						name: "2024-05-05 Test Session",
						duration: 0,
					},
				],
			}),
		);

		const durations = await loadDurations(
			YEAR,
			"test",
			PATH,
			false,
			false,
			true,
		);
		expect(durations).toEqual({});
	});
});
