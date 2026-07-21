import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	downloadData,
	getDownloadUrl,
	getWasabi,
	handleRequest,
	list,
	metadataInfo,
} from "@util/storage/wasabi";

jest.mock("@aws-sdk/client-s3", () => ({
	S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
	GetObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "GetObjectCommand",
		...params,
	})),
	HeadObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "HeadObjectCommand",
		...params,
	})),
	ListObjectsV2Command: jest.fn().mockImplementation((params) => ({
		commandName: "ListObjectsV2Command",
		...params,
	})),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: jest.fn(),
}));

const originalEnv = process.env;
let sendMock;

beforeEach(async () => {
	jest.clearAllMocks();
	process.env = {
		...originalEnv,
		WASABI_URL:
			"https://access-key:secret-key@s3.wasabisys.com/my-bucket?region=us-east-2",
	};
	const { client } = await getWasabi();
	sendMock = client.send;
	sendMock.mockReset();
});

afterAll(() => {
	process.env = originalEnv;
});

describe("getWasabi", () => {
	it("parses bucket, region, and credentials from the WASABI_URL", async () => {
		let freshGetWasabi;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetWasabi = require("@util/storage/wasabi").getWasabi;
		});

		const { bucket } = await freshGetWasabi();

		expect(bucket).toBe("my-bucket");
		expect(S3Client).toHaveBeenCalledWith(
			expect.objectContaining({
				endpoint: "https://s3.wasabisys.com",
				region: "us-east-2",
				forcePathStyle: true,
				credentials: {
					accessKeyId: "access-key",
					secretAccessKey: "secret-key",
				},
			}),
		);
	});

	it("defaults to us-east-1 when no region is specified", async () => {
		process.env.WASABI_URL =
			"https://access-key:secret-key@s3.wasabisys.com/my-bucket";
		let freshGetWasabi;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetWasabi = require("@util/storage/wasabi").getWasabi;
		});

		await freshGetWasabi();

		expect(S3Client).toHaveBeenCalledWith(
			expect.objectContaining({ region: "us-east-1" }),
		);
	});

	it("throws when WASABI_URL is not configured", async () => {
		delete process.env.WASABI_URL;
		let freshGetWasabi;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetWasabi = require("@util/storage/wasabi").getWasabi;
		});

		await expect(freshGetWasabi()).rejects.toThrow("WASABI_URL not defined");
	});

	it("caches the client across calls", async () => {
		const first = await getWasabi();
		const second = await getWasabi();

		expect(first.client).toBe(second.client);
	});
});

describe("getDownloadUrl", () => {
	it("validates the path and returns a signed url", async () => {
		getSignedUrl.mockResolvedValue("https://signed.example/file.txt");

		const url = await getDownloadUrl({ path: "/sessions/file.txt" });

		expect(url).toBe("https://signed.example/file.txt");
		expect(GetObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "sessions/file.txt" }),
		);
	});

	it("rejects traversal attempts", async () => {
		await expect(getDownloadUrl({ path: "../secret" })).rejects.toThrow(
			"ACCESS_DENIED",
		);
	});
});

describe("downloadData", () => {
	it("returns text content by default", async () => {
		sendMock.mockResolvedValue({
			Body: { transformToString: jest.fn().mockResolvedValue("hello") },
		});

		await expect(downloadData({ path: "file.txt" })).resolves.toBe("hello");
	});

	it("returns binary content as a Buffer", async () => {
		sendMock.mockResolvedValue({
			Body: {
				transformToByteArray: jest
					.fn()
					.mockResolvedValue(new Uint8Array([1, 2, 3])),
			},
		});

		const result = await downloadData({ path: "file.bin", binary: true });

		expect(Buffer.isBuffer(result)).toBe(true);
		expect([...result]).toEqual([1, 2, 3]);
	});
});

describe("metadataInfo", () => {
	it("returns file metadata from HeadObject", async () => {
		sendMock.mockResolvedValue({
			ContentType: "text/plain",
			ContentLength: 12,
			LastModified: new Date("2024-06-01"),
		});

		const result = await metadataInfo({ path: "file.txt" });

		expect(result).toMatchObject({
			type: "text/plain",
			name: "file.txt",
			size: 12,
		});
	});

	it("falls back to a directory listing when the head request fails", async () => {
		sendMock
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: "folder/" }] });

		const result = await metadataInfo({ path: "folder" });

		expect(result).toEqual({ type: "application/x-directory", name: "folder" });
	});

	it("returns null when neither the file nor a folder exists", async () => {
		sendMock
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce({ Contents: [], CommonPrefixes: [] });

		await expect(metadataInfo({ path: "missing" })).resolves.toBe(null);
	});

	it("returns null when the fallback listing also throws", async () => {
		sendMock.mockRejectedValue(new Error("still failing"));

		await expect(metadataInfo({ path: "missing" })).resolves.toBe(null);
	});
});

describe("list", () => {
	it("collects folders and files across multiple pages", async () => {
		sendMock
			.mockResolvedValueOnce({
				CommonPrefixes: [{ Prefix: "sub/" }],
				Contents: [
					{
						Key: "a.txt",
						ContentType: "text/plain",
						Size: 10,
						LastModified: new Date("2024-01-01"),
					},
				],
				NextContinuationToken: "token-1",
			})
			.mockResolvedValueOnce({
				Contents: [{ Key: "b.txt", Size: 5 }],
			});

		const items = await list({ path: "root" });

		expect(items.map((item) => item.name)).toEqual(["sub", "a.txt", "b.txt"]);
	});

	it("skips content entries without a resolvable name", async () => {
		sendMock.mockResolvedValue({ Contents: [{ Key: "root/", Size: 0 }] });

		const items = await list({ path: "root" });

		expect(items).toEqual([]);
	});
});

describe("handleRequest", () => {
	it("validates the resolved path before dispatching", async () => {
		await expect(
			handleRequest({ req: { method: "GET", query: {} }, path: "../secret" }),
		).rejects.toThrow("ACCESS_DENIED");
	});

	it("returns exists metadata for GET requests", async () => {
		sendMock.mockResolvedValue({
			ContentType: "text/plain",
			ContentLength: 3,
			LastModified: new Date("2024-01-01"),
		});

		const result = await handleRequest({
			req: { method: "GET", query: { exists: "true" } },
			path: "file.txt",
		});

		expect(result).toMatchObject({ type: "file", name: "file.txt" });
	});

	it("returns an empty object for exists checks on missing files", async () => {
		sendMock.mockRejectedValue(new Error("not found"));

		const result = await handleRequest({
			req: { method: "GET", query: { exists: "true" } },
			path: "missing.txt",
		});

		expect(result).toEqual({});
	});

	it("lists a directory for type=dir GET requests", async () => {
		sendMock.mockResolvedValue({
			CommonPrefixes: [{ Prefix: "sub/" }],
			Contents: [],
		});

		const result = await handleRequest({
			req: { method: "GET", query: { type: "dir" } },
			path: "root",
		});

		expect(result).toEqual([{ type: "dir", name: "sub" }]);
	});

	it("downloads file content for plain GET requests", async () => {
		sendMock.mockResolvedValue({
			Body: { transformToString: jest.fn().mockResolvedValue("contents") },
		});

		const result = await handleRequest({
			req: { method: "GET", query: {} },
			path: "file.txt",
		});

		expect(result).toBe("contents");
	});

	it("reads the path from request headers when not explicitly provided", async () => {
		sendMock.mockResolvedValue({
			Body: { transformToString: jest.fn().mockResolvedValue("via-header") },
		});

		const result = await handleRequest({
			req: {
				method: "GET",
				query: {},
				headers: { path: encodeURIComponent("header.txt") },
			},
		});

		expect(result).toBe("via-header");
	});

	it("rejects non-GET requests as read-only", async () => {
		await expect(
			handleRequest({ req: { method: "PUT" }, path: "file.txt" }),
		).rejects.toMatchObject({ message: "READ_ONLY_ACCESS", status: 403 });
	});

	it("downloads binary content when the binary flag is set", async () => {
		sendMock.mockResolvedValue({
			Body: {
				transformToByteArray: jest
					.fn()
					.mockResolvedValue(new Uint8Array([9, 8, 7])),
			},
		});

		const result = await handleRequest({
			req: { method: "GET", query: { binary: "true" } },
			path: "file.bin",
		});

		expect(Buffer.isBuffer(result)).toBe(true);
		expect([...result]).toEqual([9, 8, 7]);
	});

	it("treats a folder as a directory when only Contents are returned", async () => {
		sendMock
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce({ Contents: [{ Key: "folder/item.txt" }] });

		const result = await metadataInfo({ path: "folder" });

		expect(result).toEqual({
			type: "application/x-directory",
			name: "folder",
		});
	});

	it("marks directory content types as folders in listings", async () => {
		sendMock.mockResolvedValue({
			Contents: [
				{
					Key: "root/subdir/file.txt",
					ContentType: "application/x-directory",
					Size: 0,
				},
			],
		});

		const items = await list({ path: "root" });
		expect(items[0]).toMatchObject({ name: "file.txt", stat: { type: "dir" } });
	});
});
