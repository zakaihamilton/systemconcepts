export function getTrustedClientIp(request: any = {}) {
	if (request?.ip) return String(request.ip);
	return request?.headers?.get("x-vercel-forwarded-for") || "unknown";
}

export function assertSameOrigin(request: any) {
	if (process.env.NODE_ENV === "test") return;
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(request.url).origin) throw "INVALID_ORIGIN";
}
