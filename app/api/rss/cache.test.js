import {
	FEED_CACHE_HEADERS,
	MEDIA_CACHE_HEADERS,
	NO_STORE_HEADERS,
	TRANSCRIPT_CACHE_HEADERS,
} from "./cache";

describe("RSS cache policy", () => {
	it("keeps feed clients fresh while caching at Vercel for one hour", () => {
		expect(FEED_CACHE_HEADERS).toEqual({
			"Cache-Control": "public, max-age=300",
			"Vercel-CDN-Cache-Control":
				"public, max-age=21600, stale-while-revalidate=86400",
		});
	});

	it("expires media cache entries before their signed URLs", () => {
		expect(MEDIA_CACHE_HEADERS["Vercel-CDN-Cache-Control"]).toContain(
			"max-age=82800",
		);
		expect(82800).toBeLessThan(86400);
	});

	it("shares stable transcripts for seven days", () => {
		expect(TRANSCRIPT_CACHE_HEADERS).toEqual({
			"Cache-Control": "public, max-age=86400",
			"Vercel-CDN-Cache-Control":
				"public, max-age=604800, stale-while-revalidate=86400",
		});
	});

	it("never caches unsuccessful responses", () => {
		expect(NO_STORE_HEADERS).toEqual({ "Cache-Control": "no-store" });
	});
});
