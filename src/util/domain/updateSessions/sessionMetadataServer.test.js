import { downloadData, list, metadataInfo } from "@util/storage/aws";
import JSZip from "jszip";
import { aggregateSessionMetadata } from "./sessionMetadataServer";

jest.mock("@util/storage/aws", () => ({
	downloadData: jest.fn(),
	list: jest.fn(),
	metadataInfo: jest.fn(),
	validatePathAccess: jest.fn(),
}));

describe("aggregateSessionMetadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		list.mockResolvedValue([
			{
				name: "2024-05-05 Test Session.png",
				type: "file",
				stat: { type: "file", size: 100 },
			},
			{
				name: "2024-05-05 Test Session.en.vtt",
				type: "file",
				stat: { type: "file", size: 25 },
			},
			{
				name: "2024-05-05 Test Session.txt",
				type: "file",
				stat: { type: "file", size: 50 },
			},
		]);
		metadataInfo.mockResolvedValue({ type: "application/json", name: "file" });
	});

	it("parses consolidated metadata and returns fallback file listing", async () => {
		const zip = new JSZip();
		zip.file("Transcriptions/2024-05-05 Test Session.txt", "Transcript");
		const zipBuffer = await zip.generateAsync({ type: "uint8array" });

		downloadData.mockImplementation(async ({ path, binary }) => {
			if (path.endsWith(".tags")) {
				return JSON.stringify({
					sessions: [{ sessionName: "2024-05-05 Test Session", tags: ["ai."] }],
				});
			}
			if (path.endsWith(".duration")) {
				return JSON.stringify({
					sessions: [{ sessionName: "2024-05-05 Test Session", duration: 123 }],
				});
			}
			if (path.endsWith(".md")) {
				return "## 2024-05-05 Test Session\nSummary\n---\n";
			}
			if (path.endsWith(".zip") && binary) {
				return zipBuffer;
			}
			return null;
		});

		const result = await aggregateSessionMetadata({
			group: "test",
			year: "2024",
		});

		expect(list).toHaveBeenCalledWith({ path: "sessions/test/2024" });
		expect(result.items).toHaveLength(3);
		expect(result.items[0].path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
		);
		expect(result.tags["2024-05-05 Test Session"]).toEqual(["ai"]);
		expect(result.durations["2024-05-05 Test Session"]).toBe(123);
		expect(result.summaries["2024-05-05 Test Session"]).toBe("Summary");
		expect(result.transcriptions["2024-05-05 Test Session"]).toBe(true);
	});

	it("treats missing consolidated files as empty metadata maps", async () => {
		metadataInfo.mockResolvedValue(null);

		const result = await aggregateSessionMetadata({
			group: "test",
			year: "2024",
		});

		expect(result.items).toHaveLength(3);
		expect(result.tags).toEqual({});
		expect(result.durations).toEqual({});
		expect(result.summaries).toEqual({});
		expect(result.transcriptions).toEqual({});
		expect(downloadData).not.toHaveBeenCalled();
	});

	it("rejects invalid group and year input", async () => {
		await expect(
			aggregateSessionMetadata({ group: "../test", year: "2024" }),
		).rejects.toThrow("INVALID_GROUP");
		await expect(
			aggregateSessionMetadata({ group: "test", year: "24" }),
		).rejects.toThrow("INVALID_YEAR");
	});
});
