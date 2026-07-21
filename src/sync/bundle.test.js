import storage from "@util/storage/storage";
import pako from "pako";
import {
	compressJSON,
	decompressJSON,
	readCompressedFile,
	readCompressedFileRaw,
	writeCompressedFile,
} from "./bundle";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		writeFile: jest.fn(),
		createFolderPath: jest.fn(),
	},
}));

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
	},
}));

describe("compressJSON / decompressJSON", () => {
	it("round-trips JSON through gzip", () => {
		const data = { hello: "world", n: 1 };
		const compressed = compressJSON(data);
		expect(compressed).toBeInstanceOf(Uint8Array);
		expect(decompressJSON(compressed)).toEqual(data);
	});
});

describe("strict compressed reads", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("propagates transient storage failures instead of treating them as missing", async () => {
		storage.readFile.mockRejectedValue(new Error("network failed"));

		await expect(
			readCompressedFile("aws/sync/files.json.gz", { strict: true }),
		).rejects.toThrow("network failed");
	});

	it("still treats a confirmed 404 as missing", async () => {
		storage.readFile.mockRejectedValue(new Error("Failed to fetch file: 404"));

		await expect(
			readCompressedFile("aws/sync/files.json.gz", { strict: true }),
		).resolves.toBeNull();
	});
});

describe("readCompressedFileRaw", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns null for empty or missing data", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		await expect(readCompressedFileRaw("path.gz")).resolves.toBeNull();

		storage.readFile.mockResolvedValueOnce("");
		await expect(readCompressedFileRaw("path.gz")).resolves.toBeNull();
	});

	it("returns JSON strings for .json paths", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');
		await expect(readCompressedFileRaw("data.json")).resolves.toBe('{"a":1}');
	});

	it("returns Buffer contents as utf8 for .json paths that look like JSON", async () => {
		storage.readFile.mockResolvedValue(Buffer.from('{"a":1}', "utf8"));
		// .json early-return only inspects string payloads; Buffers fall through to
		// ungzip then utf-8 fallback (TextDecoder must be available).
		global.TextDecoder = require("util").TextDecoder;
		await expect(readCompressedFileRaw("data.json")).resolves.toBe('{"a":1}');
	});

	it("returns plain JSON strings even for .gz paths", async () => {
		storage.readFile.mockResolvedValue('{"plain":true}');
		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBe(
			'{"plain":true}',
		);
	});

	it("decompresses base64-encoded gzip strings", async () => {
		const payload = { ok: true };
		const gzipped = Buffer.from(pako.gzip(JSON.stringify(payload)));
		storage.readFile.mockResolvedValue(gzipped.toString("base64"));

		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBe(
			JSON.stringify(payload),
		);
	});

	it("decompresses Buffer gzip payloads", async () => {
		const payload = { from: "buffer" };
		storage.readFile.mockResolvedValue(
			Buffer.from(pako.gzip(JSON.stringify(payload))),
		);

		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBe(
			JSON.stringify(payload),
		);
	});

	it("decompresses Uint8Array gzip payloads", async () => {
		const payload = { from: "uint8" };
		storage.readFile.mockResolvedValue(pako.gzip(JSON.stringify(payload)));

		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBe(
			JSON.stringify(payload),
		);
	});

	it("returns null for unexpected data types", async () => {
		storage.readFile.mockResolvedValue(42);
		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBeNull();
	});

	it("falls back to utf-8 text when ungzip fails and strict is false", async () => {
		global.TextDecoder = require("util").TextDecoder;
		storage.readFile.mockResolvedValue(Buffer.from("not-gzip", "utf8"));
		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBe(
			"not-gzip",
		);
	});

	it("rethrows ungzip failures when strict is true", async () => {
		storage.readFile.mockResolvedValue(Buffer.from("not-gzip", "utf8"));
		await expect(
			readCompressedFileRaw("data.json.gz", { strict: true }),
		).rejects.toBeTruthy();
	});

	it("returns null and logs for non-strict unexpected read errors", async () => {
		storage.readFile.mockRejectedValue(new Error("boom"));
		await expect(readCompressedFileRaw("data.json.gz")).resolves.toBeNull();
	});
});

describe("readCompressedFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("parses decompressed JSON", async () => {
		const payload = { hello: "world" };
		storage.readFile.mockResolvedValue(
			Buffer.from(pako.gzip(JSON.stringify(payload))).toString("base64"),
		);

		await expect(readCompressedFile("file.json.gz")).resolves.toEqual(payload);
	});

	it("returns null for invalid JSON when not strict", async () => {
		storage.readFile.mockResolvedValue("{not-json");
		await expect(readCompressedFile("file.json")).resolves.toBeNull();
	});

	it("throws invalid JSON when strict", async () => {
		storage.readFile.mockResolvedValue("{not-json");
		await expect(
			readCompressedFile("file.json", { strict: true }),
		).rejects.toThrow();
	});
});

describe("writeCompressedFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.writeFile.mockResolvedValue(undefined);
	});

	it("writes pretty JSON for .json paths", async () => {
		await writeCompressedFile("local/sync/group.json", { a: 1 });

		expect(storage.createFolderPath).toHaveBeenCalled();
		expect(storage.writeFile).toHaveBeenCalledWith(
			expect.stringContaining("group.json"),
			JSON.stringify({ a: 1 }, null, 4),
		);
	});

	it("writes pre-stringified JSON as-is", async () => {
		await writeCompressedFile("local/sync/group.json", '{"raw":true}');
		expect(storage.writeFile).toHaveBeenCalledWith(
			expect.stringContaining("group.json"),
			'{"raw":true}',
		);
	});

	it("writes gzipped base64 for non-json paths", async () => {
		await writeCompressedFile("local/sync/group.json.gz", { a: 1 });

		const [, content] = storage.writeFile.mock.calls[0];
		const decoded = JSON.parse(
			pako.ungzip(Buffer.from(content, "base64"), { to: "string" }),
		);
		expect(decoded).toEqual({ a: 1 });
	});

	it("gzips Buffer/Uint8Array payloads for non-json paths", async () => {
		await writeCompressedFile(
			"local/sync/blob.gz",
			Buffer.from("hello", "utf8"),
		);
		const [, content] = storage.writeFile.mock.calls[0];
		expect(pako.ungzip(Buffer.from(content, "base64"), { to: "string" })).toBe(
			"hello",
		);
	});

	it("skips createFolderPath when the folder is already cached", async () => {
		const folderCache = new Set();
		await writeCompressedFile("local/sync/a.json", { n: 1 }, folderCache);
		await writeCompressedFile("local/sync/b.json", { n: 2 }, folderCache);

		expect(storage.createFolderPath).toHaveBeenCalledTimes(1);
		expect(folderCache.size).toBe(1);
	});

	it("throws when writing null or undefined", async () => {
		await expect(
			writeCompressedFile("local/sync/x.json", null),
		).rejects.toThrow(/Attempted to write null/);
		await expect(
			writeCompressedFile("local/sync/x.json", undefined),
		).rejects.toThrow(/Attempted to write undefined/);
	});
});
