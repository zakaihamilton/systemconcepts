import { logger as structuredLogger } from "@util/api/logger";
import {
	metadataInfo as awsMetadataInfo,
	downloadData,
} from "@util/storage/aws";
import { metadataInfo as wasabiMetadataInfo } from "@util/storage/wasabi";
import { TextDecoder } from "util";

jest.mock("@util/storage/aws", () => ({
	downloadData: jest.fn(),
	metadataInfo: jest.fn(),
}));

jest.mock("@util/storage/wasabi", () => ({
	metadataInfo: jest.fn(),
}));

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

let getSProxyUrl;
let getSessions;
let getTranscriptProxyUrl;
let getTranscriptProxyUrlFast;
let sortSessions;
let clearSessionFeedCaches;

beforeEach(() => {
	jest.clearAllMocks();
	global.TextDecoder = TextDecoder;
	({
		__clearSessionFeedCachesForTests: clearSessionFeedCaches,
		getSessions,
		getSProxyUrl,
		getTranscriptProxyUrl,
		getTranscriptProxyUrlFast,
		sortSessions,
	} = require("@util/domain/sessionFeed"));
	clearSessionFeedCaches();
});

describe("sessionFeed transcript URLs", () => {
	it("normalizes legacy aws paths before building proxy URLs", () => {
		const url = getSProxyUrl(
			"/aws/sessions/american/2025/2025-09-12 Numb.txt",
			"https://systemconcepts.app",
		);
		const encodedPath = new URL(url).searchParams.get("p");

		expect(Buffer.from(encodedPath, "base64url").toString("utf8")).toBe(
			"sessions/american/2025/2025-09-12 Numb.txt",
		);
	});

	it("does not emit stale DigitalOcean subtitle paths when a Wasabi transcript exists", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue({ type: "text/plain" });

		const url = await getTranscriptProxyUrl(
			{
				id: "2025-09-12 Numb",
				group: "american",
				year: "2025",
				transcription: true,
				subtitles: {
					path: "/aws/sessions/american/2025/2025-09-12 Numb.vtt",
				},
				video: {
					path: "wasabi/american/2025/2025-09-12 Numb.mp4",
				},
			},
			"https://systemconcepts.app",
		);
		const encodedPath = new URL(url).searchParams.get("p");

		expect(awsMetadataInfo).toHaveBeenCalledWith({
			path: "sessions/american/2025/2025-09-12 Numb.vtt",
		});
		expect(wasabiMetadataInfo).toHaveBeenCalledWith({
			path: "american/2025/2025-09-12 Numb.txt",
		});
		expect(Buffer.from(encodedPath, "base64url").toString("utf8")).toBe(
			"wasabi/american/2025/2025-09-12 Numb.txt",
		);
	});

	it("does not return a yearly zip transcript URL from the sessions API", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2025-09-12 Numb",
				group: "american",
				year: "2025",
				transcription: true,
				audio: {
					path: "/aws/sessions/american/2025/2025-09-12 Numb.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
	});

	it("returns a signed-redirect URL for an AWS transcript when a summary exists without transcription metadata", async () => {
		awsMetadataInfo.mockImplementation(({ path }) =>
			path ===
			"sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.txt"
				? Promise.resolve({ type: "text/plain" })
				: Promise.resolve(null),
		);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2026-04-28 Overview - Effort vs Finding Favor",
				group: "american",
				year: "2026",
				summaryText: "Summary created from the transcription.",
				audio: {
					path: "/aws/sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		const parsed = new URL(url);
		expect(parsed.pathname).toBe("/api/rss/s");
		expect(
			Buffer.from(parsed.searchParams.get("p"), "base64url").toString("utf8"),
		).toBe(
			"sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.txt",
		);
	});

	it("reuses transcript metadata lookups for repeated AWS transcript checks", async () => {
		awsMetadataInfo.mockResolvedValue({ type: "text/plain" });
		wasabiMetadataInfo.mockResolvedValue(null);
		const session = {
			id: "2026-06-24 Cached Transcript",
			group: "compute",
			year: "2026",
			transcriptPath:
				"/aws/sessions/compute/2026/2026-06-24 Cached Transcript.txt",
		};

		const firstUrl = await getTranscriptProxyUrl(
			session,
			"https://systemconcepts.app",
		);
		const secondUrl = await getTranscriptProxyUrl(
			session,
			"https://systemconcepts.app",
		);

		expect(firstUrl).toBe(secondUrl);
		expect(awsMetadataInfo).toHaveBeenCalledTimes(1);
		expect(awsMetadataInfo).toHaveBeenCalledWith({
			path: "sessions/compute/2026/2026-06-24 Cached Transcript.txt",
		});
	});

	it("does not fall back to a yearly zip transcript URL when no standalone transcript exists", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2026-04-28 Overview - Effort vs Finding Favor",
				group: "american",
				year: "2026",
				summaryText: "Summary created from the transcription.",
				audio: {
					path: "/aws/sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
	});
});

function jsonBuffer(obj) {
	return Buffer.from(JSON.stringify(obj), "utf-8");
}

describe("getSessions", () => {
	it("loads manifest and session files, filtering to the requested group", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([
					{ path: "/american.json" },
					{ path: "/hebrew.json" },
					{ path: "/files.json" },
					{ path: "/american/style.css" },
				]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			throw new Error(`unexpected path ${path}`);
		});

		const sessions = await getSessions({ group: "american" });
		expect(sessions).toEqual([{ id: "s1", group: "american" }]);
	});

	it("returns sessions from all groups when no group filter is provided", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([
					{ path: "/american.json" },
					{ path: "/hebrew.json" },
				]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			if (path === "sync/hebrew.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s2", group: "hebrew" }] });
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions();
		expect(sessions.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
	});

	it("includes bundle.json in the file scan and still filters its sessions by group", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([{ path: "/bundle.json" }]);
			}
			if (path === "sync/bundle.json.gz") {
				return jsonBuffer({
					sessions: [
						{ id: "b1", group: "american" },
						{ id: "b2", group: "hebrew" },
					],
				});
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions({ group: "american" });
		expect(sessions.map((s) => s.id)).toEqual(["b1"]);
	});

	it("dedupes sessions with the same group and id across multiple files", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([
					{ path: "/american.json" },
					{ path: "/american/2024.json" },
				]);
			}
			if (
				path === "sync/american.json.gz" ||
				path === "sync/american/2024.json.gz"
			) {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions({ group: "american" });
		expect(sessions).toHaveLength(1);
	});

	it("logs and continues when a single session file fails to load", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([
					{ path: "/american.json" },
					{ path: "/broken.json" },
				]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			if (path === "sync/broken.json.gz") {
				throw new Error("network fail");
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions();
		expect(sessions.map((s) => s.id)).toEqual(["s1"]);
		expect(structuredLogger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error loading"),
			expect.any(Error),
		);
	});

	it("caches the manifest and session file lookups within the TTL", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([{ path: "/american.json" }]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			return jsonBuffer({});
		});

		await getSessions({ group: "american" });
		await getSessions({ group: "american" });

		expect(downloadData).toHaveBeenCalledTimes(2);
	});
});

describe("sortSessions", () => {
	it("sorts sessions by date descending", () => {
		const sessions = [
			{ date: "2024-01-01", group: "a", name: "A" },
			{ date: "2024-03-01", group: "a", name: "B" },
		];
		expect(sortSessions(sessions).map((s) => s.date)).toEqual([
			"2024-03-01",
			"2024-01-01",
		]);
	});

	it("breaks date ties by group name, case-insensitively", () => {
		const sessions = [
			{ date: "2024-01-01", group: "Hebrew", name: "A" },
			{ date: "2024-01-01", group: "american", name: "B" },
		];
		expect(sortSessions(sessions).map((s) => s.group)).toEqual([
			"american",
			"Hebrew",
		]);
	});

	it("breaks group ties by session name", () => {
		const sessions = [
			{ date: "2024-01-01", group: "a", name: "Zeta" },
			{ date: "2024-01-01", group: "a", name: "Alpha" },
		];
		expect(sortSessions(sessions).map((s) => s.name)).toEqual([
			"Alpha",
			"Zeta",
		]);
	});

	it("handles sessions with missing date/group/name gracefully", () => {
		const sessions = [{}, { date: "2024-01-01" }];
		expect(() => sortSessions(sessions)).not.toThrow();
	});
});

describe("getTranscriptProxyUrlFast", () => {
	it("returns null when there is no session", () => {
		expect(
			getTranscriptProxyUrlFast(null, "https://systemconcepts.app"),
		).toBeNull();
	});

	it("prefers an explicit subtitles path", () => {
		const url = getTranscriptProxyUrlFast(
			{ subtitles: { path: "/aws/sessions/g/2024/2024-01-01 A.vtt" } },
			"https://systemconcepts.app",
		);
		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("sessions/g/2024/2024-01-01 A.vtt");
	});

	it("prefers an explicit transcriptPath over inferred paths", () => {
		const url = getTranscriptProxyUrlFast(
			{ transcriptPath: "/aws/sessions/g/2024/2024-01-01 A.txt" },
			"https://systemconcepts.app",
		);
		expect(url).toContain("/api/rss/s");
	});

	it("falls back to the standalone transcript path derived from session files", () => {
		const session = {
			id: "2024-01-01 A",
			group: "g",
			year: "2024",
			files: ["2024-01-01 A.txt"],
			audio: { path: "wasabi/g/2024/2024-01-01 A.m4a" },
		};
		const url = getTranscriptProxyUrlFast(
			session,
			"https://systemconcepts.app",
		);
		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("wasabi/g/2024/2024-01-01 A.txt");
	});

	it("falls back to the well-known AWS path when there is transcript evidence", () => {
		const session = {
			id: "2024-01-01 A",
			group: "g",
			year: "2024",
			transcription: true,
		};
		const url = getTranscriptProxyUrlFast(
			session,
			"https://systemconcepts.app",
		);
		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("sessions/g/2024/2024-01-01 A.txt");
	});

	it("returns null when there is no transcript evidence at all", () => {
		const session = { id: "2024-01-01 A", group: "g", year: "2024" };
		expect(
			getTranscriptProxyUrlFast(session, "https://systemconcepts.app"),
		).toBeNull();
	});
});

describe("getTranscriptProxyUrl inferred and resolution paths", () => {
	it("uses resolution media paths when audio/video are absent", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue({ type: "text/plain" });

		const url = await getTranscriptProxyUrl(
			{
				id: "2024-01-01 Res",
				group: "g",
				year: "2024",
				transcription: true,
				files: ["2024-01-01 Res.txt"],
				resolutions: {
					"720p": { path: "wasabi/g/2024/2024-01-01 Res.mp4" },
				},
			},
			"https://systemconcepts.app",
		);

		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("wasabi/g/2024/2024-01-01 Res.txt");
	});

	it("falls back to wasabi group/year transcript when media has no folder", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue({ type: "text/plain" });

		const url = await getTranscriptProxyUrl(
			{
				id: "2024-01-01 Flat",
				group: "g",
				year: "2024",
				transcription: true,
				files: ["2024-01-01 Flat.txt"],
				audio: { path: "flat.m4a" },
			},
			"https://systemconcepts.app",
		);

		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("wasabi/g/2024/2024-01-01 Flat.txt");
	});

	it("skips inferred lookup when there is no transcript evidence", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2024-01-01 None",
				group: "g",
				year: "2024",
				audio: { path: "wasabi/g/2024/2024-01-01 None.m4a" },
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
		expect(structuredLogger.debug).toHaveBeenCalledWith(
			"[Sessions API] Skipping inferred transcript lookup",
			expect.objectContaining({ reason: "no transcript evidence" }),
		);
	});

	it("skips inferred lookup when evidence exists but media path is missing", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2024-01-01 NoMedia",
				group: "g",
				year: "2024",
				transcription: true,
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
		expect(structuredLogger.debug).toHaveBeenCalledWith(
			"[Sessions API] Skipping inferred transcript lookup",
			expect.objectContaining({ reason: "no media path" }),
		);
	});

	it("clears transcript metadata cache entries when head requests fail", async () => {
		awsMetadataInfo.mockRejectedValue(new Error("head failed"));
		wasabiMetadataInfo.mockResolvedValue(null);

		await expect(
			getTranscriptProxyUrl(
				{
					id: "2024-01-01 Fail",
					group: "g",
					year: "2024",
					transcriptPath: "sessions/g/2024/2024-01-01 Fail.txt",
				},
				"https://systemconcepts.app",
			),
		).rejects.toThrow("head failed");

		awsMetadataInfo.mockResolvedValue({ type: "text/plain" });
		const url = await getTranscriptProxyUrl(
			{
				id: "2024-01-01 Fail",
				group: "g",
				year: "2024",
				transcriptPath: "sessions/g/2024/2024-01-01 Fail.txt",
			},
			"https://systemconcepts.app",
		);
		expect(url).toContain("/api/rss/s");
	});

	it("returns null for empty proxy path input", () => {
		expect(getSProxyUrl("", "https://systemconcepts.app")).toBeNull();
		expect(getSProxyUrl(null, "https://systemconcepts.app")).toBeNull();
	});
});

describe("getSessions cache and path handling", () => {
	it("clears manifest cache entries when download fails", async () => {
		downloadData.mockRejectedValueOnce(new Error("manifest fail"));
		await expect(getSessions()).rejects.toThrow("manifest fail");

		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([{ path: "/american.json" }]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions({ group: "american" });
		expect(sessions).toEqual([{ id: "s1", group: "american" }]);
		expect(downloadData).toHaveBeenCalledTimes(3);
	});

	it("loads session files whose manifest paths omit a leading slash", async () => {
		downloadData.mockImplementation(async ({ path }) => {
			if (path === "sync/files.json.gz") {
				return jsonBuffer([{ path: "american.json" }]);
			}
			if (path === "sync/american.json.gz") {
				return jsonBuffer({ sessions: [{ id: "s1", group: "american" }] });
			}
			return jsonBuffer({});
		});

		const sessions = await getSessions();
		expect(sessions).toEqual([{ id: "s1", group: "american" }]);
	});
});

describe("sortSessions date ordering", () => {
	it("orders older dates after newer dates on the same day tie", () => {
		const sessions = [
			{ date: "2024-01-01", group: "a", name: "A" },
			{ date: "2023-12-31", group: "a", name: "B" },
		];
		expect(sortSessions(sessions).map((s) => s.date)).toEqual([
			"2024-01-01",
			"2023-12-31",
		]);
	});
});

describe("getTranscriptProxyUrlFast evidence branches", () => {
	it("uses summary evidence for the AWS fallback path", () => {
		const url = getTranscriptProxyUrlFast(
			{
				id: "2024-01-01 A",
				group: "g",
				year: "2024",
				summary: "exists",
			},
			"https://systemconcepts.app",
		);
		const decoded = Buffer.from(
			new URL(url).searchParams.get("p"),
			"base64url",
		).toString("utf8");
		expect(decoded).toBe("sessions/g/2024/2024-01-01 A.txt");
	});

	it("returns null when AWS path cannot be inferred", () => {
		expect(
			getTranscriptProxyUrlFast(
				{ transcription: true },
				"https://systemconcepts.app",
			),
		).toBeNull();
	});
});
