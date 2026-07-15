export function getTrustedClientIp(request) {
	return request.headers.get("x-vercel-forwarded-for") || "unknown";
}

export function assertSameOrigin(request) {
	if (process.env.NODE_ENV === "test") return;
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(request.url).origin) throw "INVALID_ORIGIN";
}
