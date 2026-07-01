export const NO_STORE_HEADERS = {
	"Cache-Control": "no-store",
};

export const FEED_CACHE_HEADERS = {
	"Cache-Control": "public, max-age=300",
	"Vercel-CDN-Cache-Control":
		"public, max-age=21600, stale-while-revalidate=86400",
};

export const MEDIA_CACHE_HEADERS = {
	"Cache-Control": "public, max-age=3600",
	"Vercel-CDN-Cache-Control":
		"public, max-age=82800, stale-while-revalidate=3600",
};

export const TRANSCRIPT_CACHE_HEADERS = {
	"Cache-Control": "public, max-age=86400",
	"Vercel-CDN-Cache-Control":
		"public, max-age=604800, stale-while-revalidate=86400",
};
