import { fetchJSON } from "@util/api/fetch";
import { fetchSessionMetadata } from "./sessionMetadataClient";

jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
}));

const originalFetch = global.fetch;

describe("fetchSessionMetadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("aggregates metadata from presigned URLs without calling session-metadata", async () => {
		fetchJSON.mockResolvedValue({
			group: "test",
			year: "2024",
			items: [{ name: "2024-05-05 Test Session.txt", path: "/aws/sessions/test/2024/2024-05-05 Test Session.txt" }],
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
	});
});
