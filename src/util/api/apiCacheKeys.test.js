import {
	buildApiCacheKey,
	buildCanonicalApiUrl,
	getContentParams,
	getManifestFingerprint,
} from "./apiCacheKeys";
import { TextEncoder } from "util";

describe("apiCacheKeys", () => {
	const manifest = [
		{ path: "/alpha.json", version: "2" },
		{ path: "/beta.json", version: "1" },
		{ path: "/files.json", version: "9" },
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

	it("changes fingerprint when manifest versions change", () => {
		const first = getManifestFingerprint(manifest, { group: "alpha" });
		const updated = getManifestFingerprint(
			[{ path: "/alpha.json", version: "3" }],
			{ group: "alpha" },
		);

		expect(first).not.toBe(updated);
	});

	it("builds stable cache keys for identical inputs", async () => {
		const contentParams = { group: "alpha", count: 10 };
		const fingerprint = getManifestFingerprint(manifest, { group: "alpha" });
		const first = await buildApiCacheKey("rss", contentParams, fingerprint);
		const second = await buildApiCacheKey("rss", contentParams, fingerprint);

		expect(first).toBe(second);
	});

	it("builds canonical API URLs without auth params", () => {
		const params = new URLSearchParams(
			"id=user&token=secret&group=alpha&count=10",
		);
		expect(buildCanonicalApiUrl("https://systemconcepts.app", "/api/rss", params)).toBe(
			"https://systemconcepts.app/api/rss?group=alpha&count=10",
		);
	});
});
