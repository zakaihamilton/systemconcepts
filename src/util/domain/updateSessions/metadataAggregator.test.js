import JSZip from "jszip";
import { aggregateSessionMetadataFromSources } from "./metadataAggregator";

describe("aggregateSessionMetadataFromSources", () => {
	it("parses consolidated metadata from provided sources", async () => {
		const zip = new JSZip();
		zip.file("Transcriptions/2024-05-05 Test Session.txt", "Transcript");
		const zipBuffer = await zip.generateAsync({ type: "uint8array" });

		const result = await aggregateSessionMetadataFromSources({
			group: "test",
			year: "2024",
			items: [
				{
					name: "2024-05-05 Test Session.txt",
					path: "/aws/sessions/test/2024/2024-05-05 Test Session.txt",
				},
			],
			tagsContent: JSON.stringify({
				sessions: [{ sessionName: "2024-05-05 Test Session", tags: ["ai."] }],
			}),
			durationsContent: JSON.stringify({
				sessions: [{ sessionName: "2024-05-05 Test Session", duration: 123 }],
			}),
			summariesContent: "## 2024-05-05 Test Session\nSummary\n---\n",
			transcriptionsBuffer: zipBuffer,
		});

		expect(result.items).toHaveLength(1);
		expect(result.tags["2024-05-05 Test Session"]).toEqual(["ai"]);
		expect(result.durations["2024-05-05 Test Session"]).toBe(123);
		expect(result.summaries["2024-05-05 Test Session"]).toBe("Summary");
		expect(result.transcriptions["2024-05-05 Test Session"]).toBe(true);
	});
});
