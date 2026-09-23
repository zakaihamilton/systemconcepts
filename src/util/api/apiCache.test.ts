import { downloadData, getS3, uploadData } from "@util/storage/aws";
import { TextDecoder } from "util";
import { purgeApiCache, readApiCache, writeApiCache } from "./apiCache";

jest.mock("@util/storage/aws", () => ({
	downloadData: jest.fn(),
	uploadData: jest.fn(),
	getS3: jest.fn(),
}));

jest.mock("@aws-sdk/client-s3", () => ({
	DeleteObjectCommand: jest.fn(function DeleteObjectCommand(input) {
		this.input = input;
	}),
	ListObjectsV2Command: jest.fn(function ListObjectsV2Command(input) {
		this.input = input;
	}),
}));

describe("apiCache", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.TextDecoder = TextDecoder;
	});

	it("reads and writes gzipped cache objects", async () => {
		const pako = require("pako");
		const payload = JSON.stringify([{ id: "one" }]);
		asMock(downloadData).mockResolvedValue(Buffer.from(pako.gzip(payload)));

		await expect(readApiCache("sessions", "abc")).resolves.toBe(payload);
		await writeApiCache("sessions", "abc", payload);

		expect(uploadData).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "api-cache/sessions/abc.json.gz",
			}),
		);
	});

	it("returns a cache miss when the object cannot be read", async () => {
		asMock(downloadData).mockRejectedValue(new Error("not found"));

		await expect(readApiCache("sessions", "missing")).resolves.toBeNull();
	});

	it("purges all objects under api-cache/", async () => {
		const send = jest
			.fn()
			.mockResolvedValueOnce({
				Contents: [{ Key: "api-cache/rss/a.xml.gz" }],
			})
			.mockResolvedValue({});
		asMock(getS3).mockResolvedValue({ send });

		await expect(purgeApiCache()).resolves.toBe(1);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("returns zero when the cache is empty", async () => {
		const send = jest.fn().mockResolvedValue({});
		asMock(getS3).mockResolvedValue({ send });

		await expect(purgeApiCache()).resolves.toBe(0);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("paginates and ignores objects without keys", async () => {
		const send = jest
			.fn()
			.mockResolvedValueOnce({
				Contents: [{}, { Key: "api-cache/sessions/a.json.gz" }],
				NextContinuationToken: "next-page",
			})
			.mockResolvedValueOnce({ Contents: [] });
		asMock(getS3).mockResolvedValue({ send });

		await expect(purgeApiCache()).resolves.toBe(1);
		expect(send).toHaveBeenCalledTimes(3);
	});
});
