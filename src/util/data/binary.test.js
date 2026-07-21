import { getImageMimeType } from "@util/data/path";
import storage from "@util/storage/storage";
import { TextEncoder } from "util";
import {
	binaryToString,
	readBinary,
	stringToBinary,
	writeBinary,
} from "./binary";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
});

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		writeFile: jest.fn(),
	},
}));

function readBlobAsText(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsText(blob);
	});
}

function fakeBlob(text) {
	return {
		arrayBuffer: async () => new TextEncoder().encode(text).buffer,
	};
}

describe("binaryToString", () => {
	it("encodes a blob's contents as base64", async () => {
		const result = await binaryToString(fakeBlob("hello"));
		expect(result).toBe("aGVsbG8=");
	});
});

describe("stringToBinary", () => {
	it("decodes a base64 string into a blob with the given type", async () => {
		const blob = stringToBinary("aGVsbG8=", "text/plain");
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("text/plain");
		expect(await readBlobAsText(blob)).toBe("hello");
	});
});

describe("readBinary", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it("throws when the file does not exist", async () => {
		storage.readFile.mockResolvedValue(null);
		await expect(readBinary("path/to/missing.png")).rejects.toBe(
			"FILE_NOT_FOUND - path/to/missing.png",
		);
	});

	it("returns a blob with the mime type inferred from the path", async () => {
		storage.readFile.mockResolvedValue("aGVsbG8=");
		const blob = await readBinary("path/to/image.png");
		expect(blob.type).toBe(getImageMimeType("path/to/image.png"));
		expect(await readBlobAsText(blob)).toBe("hello");
	});
});

describe("writeBinary", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it("encodes the blob and writes it to storage", async () => {
		storage.writeFile.mockResolvedValue(undefined);
		await writeBinary("path/to/file.txt", fakeBlob("hello"));
		expect(storage.writeFile).toHaveBeenCalledWith(
			"path/to/file.txt",
			"aGVsbG8=",
		);
	});
});
