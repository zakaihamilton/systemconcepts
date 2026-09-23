import { downloadDataEdge } from "@util/storage/awsFetch";
import pako from "pako";
import { TextDecoder } from "util";

global.TextDecoder = TextDecoder;

const { readApiCacheEdge } = require("./apiCacheEdge");

jest.mock("@util/storage/awsFetch", () => ({
	downloadDataEdge: jest.fn(),
}));

describe("readApiCacheEdge", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("decodes gzip-compressed cached bodies", async () => {
		const payload = "<xml>hello</xml>";
		downloadDataEdge.mockResolvedValue(
			Buffer.from(pako.gzip(Buffer.from(payload, "utf-8"))),
		);

		await expect(readApiCacheEdge("rss", "abc")).resolves.toBe(payload);
		expect(downloadDataEdge).toHaveBeenCalledWith({
			path: expect.stringContaining("abc"),
			binary: true,
		});
	});

	it("returns null when the download fails", async () => {
		downloadDataEdge.mockRejectedValue(new Error("not found"));
		await expect(readApiCacheEdge("rss", "missing")).resolves.toBeNull();
	});

	it("returns null when the downloaded data cannot be decoded", async () => {
		downloadDataEdge.mockResolvedValue(Buffer.from("not gzipped data"));
		await expect(readApiCacheEdge("rss", "broken")).resolves.toBeNull();
	});
});
