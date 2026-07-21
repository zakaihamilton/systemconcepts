import { TextEncoder } from "util";
import { calculateHash, getFileInfo } from "./hash";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
});

describe("calculateHash", () => {
	it("hashes a string", async () => {
		expect(await calculateHash("hello")).toBe("4f9f2cab");
	});

	it("hashes a Uint8Array to the same value as its string form", async () => {
		expect(await calculateHash(new TextEncoder().encode("hello"))).toBe(
			"4f9f2cab",
		);
	});

	it("hashes a Buffer to the same value as its string form", async () => {
		expect(await calculateHash(Buffer.from("hello"))).toBe("4f9f2cab");
	});

	it("returns null for a falsy value", async () => {
		expect(await calculateHash(null)).toBeNull();
		expect(await calculateHash(undefined)).toBeNull();
	});

	it("hashes an empty string using the initial FNV offset basis", async () => {
		expect(await calculateHash("")).toBe("811c9dc5");
	});
});

describe("getFileInfo", () => {
	it("returns the hash and byte size for a string", async () => {
		expect(await getFileInfo("hello")).toEqual({
			hash: "4f9f2cab",
			size: 5,
		});
	});

	it("returns the hash and length for a Buffer", async () => {
		expect(await getFileInfo(Buffer.from("hello world"))).toEqual({
			hash: "d58b3fa7",
			size: 11,
		});
	});

	it("returns a null hash and 0 size for a falsy value", async () => {
		expect(await getFileInfo(null)).toEqual({ hash: null, size: 0 });
	});
});
