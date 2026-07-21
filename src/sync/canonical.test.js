import { calculateCanonicalHash, canonicalStringify } from "./canonical";
import { calculateHash } from "./hash";

jest.mock("./hash", () => ({ calculateHash: jest.fn() }));

describe("canonicalStringify", () => {
	it("stringifies primitives the same way as JSON.stringify", () => {
		expect(canonicalStringify("hi")).toBe(JSON.stringify("hi"));
		expect(canonicalStringify(42)).toBe("42");
		expect(canonicalStringify(null)).toBe("null");
		expect(canonicalStringify(true)).toBe("true");
	});

	it("stringifies arrays by recursively canonicalizing each element", () => {
		expect(canonicalStringify([1, "a", null])).toBe('[1,"a",null]');
	});

	it("sorts object keys deterministically regardless of insertion order", () => {
		const a = canonicalStringify({ b: 1, a: 2 });
		const b = canonicalStringify({ a: 2, b: 1 });
		expect(a).toBe(b);
		expect(a).toBe('{"a":2,"b":1}');
	});

	it("sorts nested object keys recursively", () => {
		const result = canonicalStringify({ z: { d: 1, c: 2 }, a: [3, 2, 1] });
		expect(result).toBe('{"a":[3,2,1],"z":{"c":2,"d":1}}');
	});
});

describe("calculateCanonicalHash", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns null for a falsy object without calling calculateHash", async () => {
		expect(await calculateCanonicalHash(null)).toBeNull();
		expect(await calculateCanonicalHash(undefined)).toBeNull();
		expect(calculateHash).not.toHaveBeenCalled();
	});

	it("hashes the canonical (key-sorted) string form of the object", async () => {
		calculateHash.mockResolvedValue("hash-value");

		const result = await calculateCanonicalHash({ b: 1, a: 2 });

		expect(calculateHash).toHaveBeenCalledWith('{"a":2,"b":1}');
		expect(result).toBe("hash-value");
	});
});
