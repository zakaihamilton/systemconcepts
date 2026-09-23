import { TextEncoder } from "util";
import {
	API_CACHE_PREFIX,
	buildApiCacheKey,
	buildCanonicalApiUrl,
	getCacheObjectPath,
	getContentParams,
	getManifestFingerprint,
} from "./apiCacheKeys";

describe("apiCacheKeys", () => {
	const manifest = [
		{ path: "/alpha.json", version: "2" },
		{ path: "/beta.json", version: "1" },
		{ path: "/files.json", version: "9" },
		{ path: "/alpha/2024.json", version: "4" },
		{ path: "/bundle.json", version: "1" },
		{ path: "/readme.txt", version: "1" },
		{ path: null, version: "1" },
	];

	beforeEach(() => {
		global.TextEncoder = TextEncoder;
		Object.defineProperty(global, "crypto", {
			configurable: true,
			value: {
				subtle: {
					digest: jest.fn(async (_algorithm, data) => {
						const hash = new Uint8Array(32);
						hash.fill(data.byteLength % 256);
						return hash.buffer;
					}),
				},
			},
		});
	});

	it("strips auth params from content keys", () => {
		const params = new URLSearchParams(
			"id=user&token=secret&group=alpha&count=10",
		);

		expect(getContentParams("rss", params)).toEqual({
			group: "alpha",
			count: 10,
		});
	});

	it("uses 50 as the default RSS count", () => {
		const params = new URLSearchParams("id=user&token=secret");

		expect(getContentParams("rss", params)).toEqual({
			group: "",
			count: 50,
		});
	});

	it("parses sessions content params with defaults and caps", () => {
		expect(
			getContentParams(
				"sessions",
				new URLSearchParams(
					"group=g&tag=t&date=2024-01-01&year=2024&query=q&index=2&count=10",
				),
			),
		).toEqual({
			group: "g",
			tag: "t",
			date: "2024-01-01",
			year: "2024",
			query: "q",
			index: 2,
			count: 10,
		});
		expect(getContentParams("sessions", new URLSearchParams(""))).toEqual({
			group: "",
			tag: "",
			date: "",
			year: "",
			query: "",
			index: 0,
			count: 100,
		});
		expect(
			getContentParams("sessions", new URLSearchParams("index=-3&count=9999")),
		).toEqual(
			expect.objectContaining({
				index: 0,
				count: 500,
			}),
		);
		expect(
			getContentParams("sessions", new URLSearchParams("index=abc&count=xyz")),
		).toEqual(expect.objectContaining({ index: 0, count: 100 }));
	});

	it("throws for unknown cache types", () => {
		expect(() => getContentParams("other", new URLSearchParams())).toThrow(
			/Unknown API cache type/,
		);
		expect(() => getCacheObjectPath("other", "key")).toThrow(
			/Unknown API cache type/,
		);
	});

	it("builds cache object paths for known types", () => {
		expect(getCacheObjectPath("sessions", "abc")).toBe(
			`${API_CACHE_PREFIX}/sessions/abc.json.gz`,
		);
		expect(getCacheObjectPath("rss", "def")).toBe(
			`${API_CACHE_PREFIX}/rss/def.xml.gz`,
		);
	});

	it("changes fingerprint when manifest versions change", () => {
		const first = getManifestFingerprint(manifest, { group: "alpha" });
		const updated = getManifestFingerprint(
			[{ path: "/alpha.json", version: "3" }],
			{ group: "alpha" },
		);

		expect(first).not.toBe(updated);
	});

	it("includes bundle and group-prefixed paths in fingerprints", () => {
		const withGroup = getManifestFingerprint(manifest, { group: "alpha" });
		expect(withGroup).toContain("/alpha.json:2");
		expect(withGroup).toContain("/alpha/2024.json:4");
		expect(withGroup).toContain("/bundle.json:1");
		expect(withGroup).not.toContain("/beta.json");
		expect(withGroup).not.toContain("/files.json");
		expect(getManifestFingerprint(null)).toBe("");
		expect(getManifestFingerprint(manifest)).toContain("/beta.json:1");
		expect(
			getManifestFingerprint([{ path: "/alpha.json" }], { group: "Alpha" }),
		).toContain("/alpha.json:0");
	});

	it("builds stable cache keys for identical inputs", async () => {
		const contentParams = { group: "alpha", count: 10 };
		const fingerprint = getManifestFingerprint(manifest, { group: "alpha" });
		const first = await buildApiCacheKey("rss", contentParams, fingerprint);
		const second = await buildApiCacheKey("rss", contentParams, fingerprint);

		expect(first).toBe(second);
		const sessionsKey = await buildApiCacheKey(
			"sessions",
			contentParams,
			fingerprint,
		);
		expect(sessionsKey).toHaveLength(64);
		expect(sessionsKey).not.toBe(first);
	});

	it("builds canonical API URLs without auth params", () => {
		const params = new URLSearchParams(
			"id=user&token=secret&group=alpha&count=10",
		);
		expect(
			buildCanonicalApiUrl("https://systemconcepts.app", "/api/rss", params),
		).toBe("https://systemconcepts.app/api/rss?group=alpha&count=10");
	});
});
