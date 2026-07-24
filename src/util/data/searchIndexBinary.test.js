import pako from "pako";
import { TextDecoder, TextEncoder } from "util";
import { decodeBinaryIndex, encodeBinaryIndex } from "./searchIndexBinary";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
	global.TextDecoder = TextDecoder;
});

const MAGIC = 0x53495831; // 'SIX1'

function buildRawIndexBuffer({
	version = 4,
	timestamp = 1_700_000_000_000,
	strings = [],
	fileIdIndices = [],
	docs = null,
	tokens = [],
	corruptMagic = false,
} = {}) {
	const encoder = new TextEncoder();
	const encodedStrings = strings.map((s) => encoder.encode(s));

	let size = 16;
	size += 1 + encodedStrings.reduce((sum, enc) => sum + 1 + enc.length, 0);
	size += 1 + fileIdIndices.length;
	if (docs) {
		size += 1;
		for (const doc of docs) {
			size += 1 + 1 + doc.paraIndices.length;
		}
	}
	size += 1;
	for (const token of tokens) {
		size += 1 + 1 + token.refs.length * 2;
	}

	const buffer = new Uint8Array(size + 64);
	const view = new DataView(buffer.buffer);
	let offset = 0;

	view.setUint32(offset, corruptMagic ? 0xdeadbeef : MAGIC, false);
	offset += 4;
	view.setUint32(offset, version, false);
	offset += 4;
	view.setUint32(offset, Math.floor(timestamp / 0x100000000), false);
	offset += 4;
	view.setUint32(offset, timestamp >>> 0, false);
	offset += 4;

	const writeVarInt = (value) => {
		while (value > 0x7f) {
			buffer[offset++] = (value & 0x7f) | 0x80;
			value >>>= 7;
		}
		buffer[offset++] = value;
	};

	const writeSignedVarInt = (value) => {
		const encoded = (value << 1) ^ (value >> 31);
		writeVarInt(encoded >>> 0);
	};

	writeVarInt(strings.length);
	for (const encoded of encodedStrings) {
		writeVarInt(encoded.length);
		buffer.set(encoded, offset);
		offset += encoded.length;
	}

	writeVarInt(fileIdIndices.length);
	for (const idx of fileIdIndices) {
		writeVarInt(idx);
	}

	if (docs) {
		writeVarInt(docs.length);
		for (const doc of docs) {
			writeVarInt(doc.fileIdx);
			writeVarInt(doc.paraIndices.length);
			for (const paraIdx of doc.paraIndices) {
				writeVarInt(paraIdx);
			}
		}
	}

	writeVarInt(tokens.length);
	for (const token of tokens) {
		writeVarInt(token.tokenIdx);
		writeVarInt(token.refs.length);
		for (const ref of token.refs) {
			writeSignedVarInt(ref);
		}
	}

	return pako.gzip(buffer.slice(0, offset));
}

describe("encodeBinaryIndex", () => {
	it("returns gzip-compressed binary data", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 12345,
			f: ["a"],
			t: { hello: [0] },
		});

		expect(encoded).toBeInstanceOf(Uint8Array);
		expect(encoded.length).toBeGreaterThan(0);
		// gzip magic bytes
		expect(encoded[0]).toBe(0x1f);
		expect(encoded[1]).toBe(0x8b);

		const raw = pako.ungzip(encoded);
		const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
		expect(view.getUint32(0, false)).toBe(MAGIC);
		expect(view.getUint32(4, false)).toBe(5);
	});

	it("defaults version to 4 and uses Date.now for timestamp when omitted", () => {
		const before = Date.now();
		const encoded = encodeBinaryIndex({
			f: [],
			d: { 0: ["only"] },
			t: {},
		});
		const after = Date.now();

		const decoded = decodeBinaryIndex(encoded);
		expect(decoded.v).toBe(4);
		expect(decoded.timestamp).toBeGreaterThanOrEqual(before);
		expect(decoded.timestamp).toBeLessThanOrEqual(after);
	});

	it("deduplicates repeated strings in the string table", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 1,
			f: ["shared"],
			t: { shared: [0] },
		});
		const raw = pako.ungzip(encoded);
		// After header (16 bytes), first varint is string count.
		// "shared" appears as both file id and token, so count should be 1.
		expect(raw[16]).toBe(1);
	});
});

describe("decodeBinaryIndex", () => {
	it("accepts Uint8Array input", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 99,
			f: ["file"],
			t: { tok: [0] },
		});
		const decoded = decodeBinaryIndex(encoded);
		expect(decoded.f).toEqual(["file"]);
		expect(decoded.t).toEqual({ tok: [0] });
	});

	it("accepts ArrayBuffer input", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 99,
			f: ["file"],
			t: { tok: [0] },
		});
		const decoded = decodeBinaryIndex(
			encoded.buffer.slice(
				encoded.byteOffset,
				encoded.byteOffset + encoded.byteLength,
			),
		);
		expect(decoded.f).toEqual(["file"]);
	});

	it("accepts legacy plain Array binary input", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 99,
			f: ["file"],
			t: { tok: [1, -1] },
		});
		const decoded = decodeBinaryIndex(Array.from(encoded));
		expect(decoded.t.tok).toEqual([1, -1]);
	});

	it("passes through other binary-like input types", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 99,
			f: ["file"],
			t: { tok: [0] },
		});
		// Uint8ClampedArray is not Uint8Array/ArrayBuffer/Array/string
		const clamped = new Uint8ClampedArray(encoded);
		const decoded = decodeBinaryIndex(clamped);
		expect(decoded.f).toEqual(["file"]);
	});

	it("throws when data was read as a string", () => {
		expect(() => decodeBinaryIndex("not-binary")).toThrow(
			"Search index was read as text instead of binary. Please rebuild the index.",
		);
	});

	it("throws on invalid magic bytes", () => {
		const bad = buildRawIndexBuffer({
			version: 5,
			corruptMagic: true,
			strings: ["a"],
			fileIdIndices: [0],
			tokens: [{ tokenIdx: 0, refs: [0] }],
		});
		expect(() => decodeBinaryIndex(bad)).toThrow(
			"Invalid search index binary format",
		);
	});
});

describe("round-trip encode → decode", () => {
	it("round-trips a minimal v5 index", () => {
		const index = {
			v: 5,
			timestamp: 1_700_000_000_000,
			f: [],
			t: {},
		};
		const decoded = decodeBinaryIndex(encodeBinaryIndex(index));
		expect(decoded).toEqual({
			v: 5,
			timestamp: 1_700_000_000_000,
			f: [],
			d: {},
			t: {},
		});
	});

	it("round-trips v5 with files and tokens including signed refs", () => {
		const index = {
			v: 5,
			timestamp: 42,
			f: ["alpha", "beta", "gamma"],
			t: {
				hello: [0, 1, 2],
				world: [-1, -2, 3, -10],
				empty: [],
			},
		};
		const decoded = decodeBinaryIndex(encodeBinaryIndex(index));
		expect(decoded.v).toBe(5);
		expect(decoded.timestamp).toBe(42);
		expect(decoded.f).toEqual(["alpha", "beta", "gamma"]);
		expect(decoded.d).toEqual({});
		expect(decoded.t).toEqual({
			hello: [0, 1, 2],
			world: [-1, -2, 3, -10],
			empty: [],
		});
	});

	it("round-trips v4 indexes with document paragraphs", () => {
		const index = {
			v: 4,
			timestamp: 99,
			f: ["doc-a", "doc-b"],
			d: {
				0: ["first paragraph", "second paragraph"],
				1: ["only paragraph"],
			},
			t: {
				search: [0, -1],
				term: [1],
			},
		};
		const decoded = decodeBinaryIndex(encodeBinaryIndex(index));
		expect(decoded.v).toBe(4);
		expect(decoded.timestamp).toBe(99);
		expect(decoded.f).toEqual(["doc-a", "doc-b"]);
		expect(decoded.d).toEqual({
			0: ["first paragraph", "second paragraph"],
			1: ["only paragraph"],
		});
		expect(decoded.t).toEqual({
			search: [0, -1],
			term: [1],
		});
	});

	it("writes documents sorted by file index for v4", () => {
		const index = {
			v: 4,
			timestamp: 1,
			f: ["a", "b", "c"],
			d: {
				2: ["c-para"],
				0: ["a-para"],
				1: ["b-para"],
			},
			t: {},
		};
		const decoded = decodeBinaryIndex(encodeBinaryIndex(index));
		expect(Object.keys(decoded.d).map(Number)).toEqual([0, 1, 2]);
		expect(decoded.d).toEqual({
			0: ["a-para"],
			1: ["b-para"],
			2: ["c-para"],
		});
	});

	it("preserves unicode strings", () => {
		const index = {
			v: 5,
			timestamp: 7,
			f: ["файл", "📄"],
			t: { שלום: [0], café: [-1] },
		};
		const decoded = decodeBinaryIndex(encodeBinaryIndex(index));
		expect(decoded.f).toEqual(["файл", "📄"]);
		expect(decoded.t).toEqual({ שלום: [0], café: [-1] });
	});

	it("preserves large timestamps across the 32-bit boundary", () => {
		const timestamp = 0x1_0000_0000 + 123456789;
		const decoded = decodeBinaryIndex(
			encodeBinaryIndex({
				v: 5,
				timestamp,
				f: [],
				t: {},
			}),
		);
		expect(decoded.timestamp).toBe(timestamp);
	});

	it("preserves large positive and negative token refs", () => {
		const refs = [0, 1, -1, 127, -128, 16383, -16384, 100000, -100000];
		const decoded = decodeBinaryIndex(
			encodeBinaryIndex({
				v: 5,
				timestamp: 1,
				f: ["f"],
				t: { big: refs },
			}),
		);
		expect(decoded.t.big).toEqual(refs);
	});
});

describe("version branches", () => {
	it("skips reading documents for v5 even when none are present", () => {
		const compressed = buildRawIndexBuffer({
			version: 5,
			timestamp: 55,
			strings: ["file", "tok"],
			fileIdIndices: [0],
			docs: null,
			tokens: [{ tokenIdx: 1, refs: [0, -1] }],
		});
		const decoded = decodeBinaryIndex(compressed);
		expect(decoded.v).toBe(5);
		expect(decoded.d).toEqual({});
		expect(decoded.f).toEqual(["file"]);
		expect(decoded.t).toEqual({ tok: [0, -1] });
	});

	it("reads documents for v4 and below", () => {
		const compressed = buildRawIndexBuffer({
			version: 4,
			timestamp: 44,
			strings: ["file", "para", "tok"],
			fileIdIndices: [0],
			docs: [{ fileIdx: 0, paraIndices: [1] }],
			tokens: [{ tokenIdx: 2, refs: [0] }],
		});
		const decoded = decodeBinaryIndex(compressed);
		expect(decoded.v).toBe(4);
		expect(decoded.d).toEqual({ 0: ["para"] });
		expect(decoded.t).toEqual({ tok: [0] });
	});

	it("treats version 3 like v4 for document reading", () => {
		const compressed = buildRawIndexBuffer({
			version: 3,
			timestamp: 33,
			strings: ["f", "p"],
			fileIdIndices: [0],
			docs: [{ fileIdx: 0, paraIndices: [1] }],
			tokens: [],
		});
		const decoded = decodeBinaryIndex(compressed);
		expect(decoded.v).toBe(3);
		expect(decoded.d).toEqual({ 0: ["p"] });
	});

	it("does not emit a documents section when d is omitted (v5 path)", () => {
		const encoded = encodeBinaryIndex({
			v: 5,
			timestamp: 1,
			f: ["only"],
			t: { a: [0] },
		});
		const decoded = decodeBinaryIndex(encoded);
		expect(decoded.d).toEqual({});
		expect(decoded.f).toEqual(["only"]);
		expect(decoded.t).toEqual({ a: [0] });
	});
});

describe("gzip paths", () => {
	it("decode ungrips encode output", () => {
		const index = {
			v: 5,
			timestamp: 10,
			f: ["x"],
			t: { y: [0] },
		};
		const compressed = encodeBinaryIndex(index);
		const manually = pako.ungzip(compressed);
		expect(manually.length).toBeGreaterThan(16);

		const decoded = decodeBinaryIndex(compressed);
		expect(decoded.f).toEqual(["x"]);
	});

	it("decode accepts data that was gzipped separately", () => {
		// Build via encode then re-gzip is not valid (double gzip).
		// Instead verify ungzip of encode output matches a second decode.
		const index = {
			v: 5,
			timestamp: 11,
			f: ["z"],
			t: { w: [-2, 2] },
		};
		const once = encodeBinaryIndex(index);
		expect(decodeBinaryIndex(once)).toEqual(
			decodeBinaryIndex(Uint8Array.from(once)),
		);
	});
});
