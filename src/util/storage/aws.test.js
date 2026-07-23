import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	copyFile,
	deleteFile,
	downloadData,
	downloadFile,
	getDownloadUrl,
	getS3,
	handleRequest,
	list,
	metadataInfo,
	moveFile,
	uploadData,
	uploadFile,
	validatePathAccess,
} from "@util/storage/aws";
import { EventEmitter } from "events";
import fs from "fs";

jest.mock("@aws-sdk/client-s3", () => ({
	S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
	GetObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "GetObjectCommand",
		...params,
	})),
	PutObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "PutObjectCommand",
		...params,
	})),
	DeleteObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "DeleteObjectCommand",
		...params,
	})),
	CopyObjectCommand: jest.fn().mockImplementation((params) => ({
		commandName: "CopyObjectCommand",
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
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("fs", () => ({
	existsSync: jest.fn(),
	createReadStream: jest.fn(),
	createWriteStream: jest.fn(),
	writeFileSync: jest.fn(),
}));

const originalEnv = process.env;
let sendMock;

beforeEach(async () => {
	jest.clearAllMocks();
	process.env = {
		...originalEnv,
		AWS_BUCKET: "default-bucket",
		AWS_ID: "access-key",
		AWS_SECRET: "secret-key",
		AWS_ENDPOINT: "sfo3.digitaloceanspaces.com",
	};
	const s3 = await getS3({});
	sendMock = s3.send;
	sendMock.mockReset();
});

afterAll(() => {
	process.env = originalEnv;
});

describe("getS3", () => {
	it("caches the client across calls", async () => {
		const first = await getS3({});
		const second = await getS3({});

		expect(first).toBe(second);
	});

	it("logs when credentials are missing but still constructs a client", async () => {
		delete process.env.AWS_ID;
		delete process.env.AWS_SECRET;

		let freshGetS3;
		let freshLogger;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetS3 = require("@util/storage/aws").getS3;
			// eslint-disable-next-line global-require
			freshLogger = require("@util/api/logger").logger;
		});

		await freshGetS3({});

		expect(freshLogger.error).toHaveBeenCalledWith(
			expect.stringContaining("Missing AWS credentials"),
		);
	});

	it("logs and continues when the endpoint is an invalid URL", async () => {
		process.env.AWS_ENDPOINT = "http://";

		let freshGetS3;
		let freshLogger;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetS3 = require("@util/storage/aws").getS3;
			// eslint-disable-next-line global-require
			freshLogger = require("@util/api/logger").logger;
		});

		await freshGetS3({});

		expect(freshLogger.error).toHaveBeenCalledWith(
			"getS3: Invalid endpoint URL:",
			"http://",
		);
	});

	it("prepends https:// to bare endpoint hostnames", async () => {
		let freshGetS3;
		jest.isolateModules(() => {
			// eslint-disable-next-line global-require
			freshGetS3 = require("@util/storage/aws").getS3;
		});

		await freshGetS3({ endpoint: "example.com" });

		expect(S3Client).toHaveBeenCalledWith(
			expect.objectContaining({ endpoint: "https://example.com" }),
		);
	});
});

describe("validatePathAccess", () => {
	it("allows a falsy path", () => {
		expect(() => validatePathAccess("")).not.toThrow();
		expect(() => validatePathAccess(undefined)).not.toThrow();
	});

	it("allows normal paths", () => {
		expect(() => validatePathAccess("sessions/test/file.txt")).not.toThrow();
	});

	it("blocks path traversal", () => {
		expect(() => validatePathAccess("sessions/../secret")).toThrow(
			"ACCESS_DENIED",
		);
	});

	it("blocks encoded path traversal", () => {
		expect(() => validatePathAccess("sessions%2F..%2Fsecret")).toThrow(
			"ACCESS_DENIED",
		);
	});

	it("blocks the private folder", () => {
		expect(() => validatePathAccess("private")).toThrow("ACCESS_DENIED");
		expect(() => validatePathAccess("private/secret.txt")).toThrow(
			"ACCESS_DENIED",
		);
	});
});

describe("getDownloadUrl", () => {
	it("builds a signed GET url for the default bucket", async () => {
		getSignedUrl.mockResolvedValue("https://signed.example/file.txt");

		const url = await getDownloadUrl({ path: "/sessions/file.txt" });

		expect(url).toBe("https://signed.example/file.txt");
		expect(GetObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				Bucket: "default-bucket",
				Key: "sessions/file.txt",
			}),
		);
	});

	it("forwards a custom content disposition", async () => {
		getSignedUrl.mockResolvedValue("https://signed.example/file.txt");

		await getDownloadUrl({
			path: "file.txt",
			responseContentDisposition: "attachment",
		});

		expect(GetObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ ResponseContentDisposition: "attachment" }),
		);
	});
});

describe("uploadFile", () => {
	it("throws when the source file does not exist", async () => {
		fs.existsSync.mockReturnValue(false);

		await expect(
			uploadFile({ from: "/tmp/missing.txt", to: "dest.txt" }),
		).rejects.toThrow("Source file not found");
	});

	it("uploads the file stream to S3", async () => {
		fs.existsSync.mockReturnValue(true);
		const stream = {};
		fs.createReadStream.mockReturnValue(stream);
		sendMock.mockResolvedValue({});

		await uploadFile({ from: "/tmp/source.txt", to: "dest.txt" });

		expect(sendMock).toHaveBeenCalledWith(
			expect.objectContaining({ Body: stream, Key: "dest.txt" }),
		);
	});
});

describe("downloadFile", () => {
	it("pipes the response body to the destination when supported", async () => {
		const fileStream = new EventEmitter();
		fs.createWriteStream.mockReturnValue(fileStream);
		const body = new EventEmitter();
		body.pipe = jest.fn((dest) => {
			setTimeout(() => dest.emit("finish"), 0);
		});
		sendMock.mockResolvedValue({ Body: body });

		await downloadFile({ from: "src.txt", to: "/tmp/dest.txt" });

		expect(body.pipe).toHaveBeenCalledWith(fileStream);
	});

	it("falls back to writeFileSync when the body cannot be piped", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		sendMock.mockResolvedValue({
			Body: { transformToByteArray: jest.fn().mockResolvedValue(bytes) },
		});

		await downloadFile({ from: "src.txt", to: "/tmp/dest.txt" });

		expect(fs.writeFileSync).toHaveBeenCalledWith("/tmp/dest.txt", bytes);
	});
});

describe("uploadData / downloadData", () => {
	it("uploads raw data with a public-read ACL", async () => {
		sendMock.mockResolvedValue({});

		await uploadData({ path: "/data.json", data: "{}" });

		expect(sendMock).toHaveBeenCalledWith(
			expect.objectContaining({
				Key: "data.json",
				Body: "{}",
				ACL: "public-read",
			}),
		);
	});

	it("downloads text content", async () => {
		sendMock.mockResolvedValue({
			Body: { transformToString: jest.fn().mockResolvedValue("hello") },
		});

		await expect(downloadData({ path: "data.txt" })).resolves.toBe("hello");
	});

	it("downloads binary content as a Buffer", async () => {
		sendMock.mockResolvedValue({
			Body: {
				transformToByteArray: jest
					.fn()
					.mockResolvedValue(new Uint8Array([1, 2, 3])),
			},
		});

		const result = await downloadData({ path: "data.bin", binary: true });

		expect(Buffer.isBuffer(result)).toBe(true);
		expect([...result]).toEqual([1, 2, 3]);
	});
});

describe("copyFile / moveFile / deleteFile", () => {
	it("copies within the default bucket when no bucket prefix is given", async () => {
		sendMock.mockResolvedValue({});

		await copyFile("from.txt", "to.txt");

		expect(CopyObjectCommand).toHaveBeenCalledWith({
			Bucket: "default-bucket",
			CopySource: "default-bucket/from.txt",
			Key: "to.txt",
		});
	});

	it("copies across explicit bucket/path pairs", async () => {
		sendMock.mockResolvedValue({});

		await copyFile("bucket-a/from.txt", "bucket-b/to.txt");

		expect(CopyObjectCommand).toHaveBeenCalledWith({
			Bucket: "bucket-b",
			CopySource: "bucket-a/from.txt",
			Key: "to.txt",
		});
	});

	it("moves a file by copying then deleting the source", async () => {
		sendMock.mockResolvedValue({});

		await moveFile({ from: "from.txt", to: "to.txt" });

		expect(CopyObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "to.txt" }),
		);
		expect(DeleteObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "from.txt" }),
		);
	});

	it("deletes a file", async () => {
		sendMock.mockResolvedValue({});

		await deleteFile({ path: "/gone.txt" });

		expect(DeleteObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "gone.txt" }),
		);
	});
});

describe("metadataInfo", () => {
	it("returns file metadata from HeadObject", async () => {
		sendMock.mockResolvedValue({
			ContentType: "text/plain",
			ContentLength: 42,
			LastModified: new Date("2024-01-01"),
		});

		const result = await metadataInfo({ path: "file.txt" });

		expect(result).toMatchObject({
			type: "text/plain",
			name: "file.txt",
			size: 42,
		});
	});

	it("falls back to a directory listing when the head request fails", async () => {
		sendMock
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: "folder/" }] });

		const result = await metadataInfo({ path: "folder" });

		expect(result).toEqual({
			type: "application/x-directory",
			name: "folder",
		});
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
	it("collects files and folders, excluding private, across pages", async () => {
		sendMock
			.mockResolvedValueOnce({
				CommonPrefixes: [{ Prefix: "sub/" }, { Prefix: "private/" }],
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

	it("stops when a continuation token repeats", async () => {
		sendMock.mockResolvedValue({
			Contents: [{ Key: "a.txt", Size: 1 }],
			NextContinuationToken: "same-token",
		});

		await list({ path: "root" });

		// First page (no token) + second page (token once). Third would repeat.
		expect(sendMock).toHaveBeenCalledTimes(2);
	});

	it("includes child directory counts when requested", async () => {
		sendMock
			.mockResolvedValueOnce({
				CommonPrefixes: [{ Prefix: "sub/" }],
			})
			.mockResolvedValueOnce({
				CommonPrefixes: [{ Prefix: "sub/child/" }],
				Contents: [{ Key: "sub/file.txt" }],
			});

		const items = await list({ path: "root", includeCounts: true });

		expect(items[0]).toMatchObject({ name: "sub", type: "dir", count: 2 });
	});

	it("skips the private folder in directory listings", async () => {
		sendMock.mockResolvedValue({
			CommonPrefixes: [{ Prefix: "private/" }, { Prefix: "public/" }],
		});

		const items = await list({ path: "root" });
		expect(items.map((item) => item.name)).toEqual(["public"]);
	});

	it("marks application/x-directory content entries as folders", async () => {
		sendMock.mockResolvedValue({
			Contents: [
				{
					Key: "root/subdir",
					ContentType: "application/x-directory",
					Size: 0,
				},
			],
		});

		const items = await list({ path: "root" });
		expect(items[0].stat.type).toBe("dir");
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

	it("returns an empty string when the object is missing (NoSuchKey)", async () => {
		sendMock.mockRejectedValue({ name: "NoSuchKey" });

		const result = await handleRequest({
			req: { method: "GET", query: {} },
			path: "missing.txt",
		});

		expect(result).toBe("");
	});

	it("returns a safe error payload for unexpected GET failures", async () => {
		sendMock.mockRejectedValue(new Error("boom"));

		const result = await handleRequest({
			req: { method: "GET", query: {} },
			path: "file.txt",
		});

		expect(result).toEqual({ err: expect.any(String) });
	});

	it("rejects writes when readOnly is set", async () => {
		await expect(
			handleRequest({
				readOnly: true,
				req: { method: "PUT", body: { path: "file.txt", body: "x" } },
			}),
		).rejects.toMatchObject({ message: "READ_ONLY_ACCESS", status: 403 });
	});

	it("uploads a single PUT item, decoding base64 for binary paths", async () => {
		sendMock.mockResolvedValue({});

		const result = await handleRequest({
			req: {
				method: "PUT",
				body: { path: "image.png", body: Buffer.from("hi").toString("base64") },
			},
		});

		expect(result).toEqual({ success: true });
		expect(sendMock).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "image.png" }),
		);
	});

	it("uploads a batch of PUT items", async () => {
		sendMock.mockResolvedValue({});

		const result = await handleRequest({
			req: {
				method: "PUT",
				body: [
					{ path: "a.txt", body: "one" },
					{ path: "b.txt", body: "two" },
				],
			},
		});

		expect(result).toEqual({ success: true });
		expect(sendMock).toHaveBeenCalledTimes(2);
	});

	it("rejects deletes when readOnly is set", async () => {
		await expect(
			handleRequest({
				readOnly: true,
				req: { method: "DELETE" },
				path: "file.txt",
			}),
		).rejects.toMatchObject({ message: "READ_ONLY_ACCESS", status: 403 });
	});

	it("deletes the resolved path for DELETE requests", async () => {
		sendMock.mockResolvedValue({});

		const result = await handleRequest({
			req: { method: "DELETE" },
			path: "file.txt",
		});

		expect(result).toEqual({ success: true });
		expect(DeleteObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({ Key: "file.txt" }),
		);
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

	it("lists directories with counts when the counts header is set", async () => {
		sendMock
			.mockResolvedValueOnce({
				CommonPrefixes: [{ Prefix: "sub/" }],
			})
			.mockResolvedValueOnce({
				Contents: [{ Key: "sub/file.txt" }],
			});

		const result = await handleRequest({
			req: {
				method: "GET",
				query: { type: "dir" },
				headers: { counts: "1" },
			},
			path: "root",
		});

		expect(result[0]).toMatchObject({ name: "sub", count: 1 });
	});

	it("returns directory metadata for exists checks", async () => {
		sendMock
			.mockRejectedValueOnce(new Error("not found"))
			.mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: "folder/" }] });

		const result = await handleRequest({
			req: { method: "GET", query: { exists: "true" } },
			path: "folder",
		});

		expect(result).toMatchObject({ type: "dir", name: "folder" });
	});
});
