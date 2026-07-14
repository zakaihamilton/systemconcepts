import { fetchJSON } from "@util/api/fetch";
import { logger } from "@util/api/logger";
import {
	clearSessionMetadataCache,
	fetchSessionMetadata,
} from "./sessionMetadataClient";

jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

const originalFetch = global.fetch;

describe("fetchSessionMetadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		clearSessionMetadataCache();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("aggregates metadata from presigned URLs without calling session-metadata", async () => {
		fetchJSON.mockResolvedValue({
			group: "test",
			year: "2024",
			items: [
				{
					name: "2024-05-05 Test Session.txt",
					path: "/aws/sessions/test/2024/2024-05-05 Test Session.txt",
				},
			],
			urls: {
				tags: "https://signed/tags",
				duration: "https://signed/duration",
				md: "https://signed/md",
				zip: null,
			},
		});
		global.fetch.mockImplementation(async (url) => {
			if (url === "https://signed/tags") {
				return {
					ok: true,
					status: 200,
					text: async () =>
						JSON.stringify({
							sessions: [
								{ sessionName: "2024-05-05 Test Session", tags: ["ai"] },
							],
						}),
				};
			}
			if (url === "https://signed/duration") {
				return {
					ok: true,
					status: 200,
					text: async () =>
						JSON.stringify({
							sessions: [
								{ sessionName: "2024-05-05 Test Session", duration: 123 },
							],
						}),
				};
			}
			if (url === "https://signed/md") {
				return {
					ok: true,
					status: 200,
					text: async () => "## 2024-05-05 Test Session\nSummary\n",
				};
			}
			return { ok: false, status: 404 };
		});

		const result = await fetchSessionMetadata("test", "2024", [], false);

		expect(fetchJSON).toHaveBeenCalledWith(
			expect.stringContaining("/api/aws_download?"),
			expect.objectContaining({ method: "GET" }),
		);
		expect(fetchJSON).not.toHaveBeenCalledWith(
			expect.stringContaining("/api/session-metadata"),
			expect.anything(),
		);
		expect(result.tags["2024-05-05 Test Session"]).toEqual(["ai"]);
		expect(result.durations["2024-05-05 Test Session"]).toBe(123);
		expect(result.summaries["2024-05-05 Test Session"]).toBe("Summary");
	});

	it("falls back to session-metadata when presign fetch fails", async () => {
		fetchJSON
			.mockRejectedValueOnce(new Error("presign failed"))
			.mockResolvedValueOnce({
				group: "test",
				year: "2024",
				items: [],
				tags: { "2024-05-05 Test Session": ["fallback"] },
				durations: {},
				summaries: {},
				transcriptions: {},
			});

		const result = await fetchSessionMetadata("test", "2024", [], true);

		expect(fetchJSON).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("/api/aws_download?"),
			expect.any(Object),
		);
		expect(fetchJSON).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("/api/session-metadata?"),
			expect.any(Object),
		);
		expect(result.tags["2024-05-05 Test Session"]).toEqual(["fallback"]);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Presigned fetch failed"),
			expect.any(Error),
		);
	});

	it("dedupes concurrent requests for the same metadata key", async () => {
		let resolveFetch;
		const fetchGate = new Promise((resolve) => {
			resolveFetch = resolve;
		});
		fetchJSON.mockImplementation(async () => {
			await fetchGate;
			return {
				group: "test",
				year: "2024",
				items: [],
				urls: { tags: null, duration: null, md: null, zip: null },
			};
		});

		const first = fetchSessionMetadata("test", "2024", "fp-1", false);
		const second = fetchSessionMetadata("test", "2024", "fp-1", false);

		resolveFetch();
		const [resultA, resultB] = await Promise.all([first, second]);

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		expect(resultA).toBe(resultB);
	});

	it("does not dedupe concurrent requests when forceUpdate is true", async () => {
		let resolveFetch;
		const fetchGate = new Promise((resolve) => {
			resolveFetch = resolve;
		});
		fetchJSON.mockImplementation(async () => {
			await fetchGate;
			return {
				group: "test",
				year: "2024",
				items: [],
				urls: { tags: null, duration: null, md: null, zip: null },
			};
		});

		const first = fetchSessionMetadata("test", "2024", "fp-1", true);
		const second = fetchSessionMetadata("test", "2024", "fp-1", true);

		resolveFetch();
		await Promise.all([first, second]);

		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});
});
