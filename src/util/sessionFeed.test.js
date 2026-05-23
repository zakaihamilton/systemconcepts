import { metadataInfo as awsMetadataInfo } from "@util/aws";
import { metadataInfo as wasabiMetadataInfo } from "@util/wasabi";
import { TextDecoder } from "util";

jest.mock("@util/aws", () => ({
	downloadData: jest.fn(),
	metadataInfo: jest.fn(),
}));

jest.mock("@util/wasabi", () => ({
	metadataInfo: jest.fn(),
}));

describe("sessionFeed transcript URLs", () => {
	let getSProxyUrl;
	let getTranscriptProxyUrl;

	beforeEach(() => {
		jest.clearAllMocks();
		global.TextDecoder = TextDecoder;
		({ getSProxyUrl, getTranscriptProxyUrl } = require("./sessionFeed"));
	});

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
});
