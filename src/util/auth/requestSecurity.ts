export function getTrustedClientIp(request: any = {}) {
	if (request?.ip) return String(request.ip);
	// A self-hosted proxy must overwrite this header, not append untrusted input.
	const header =
		process.env.TRUSTED_CLIENT_IP_HEADER || "x-vercel-forwarded-for";
	const forwarded = request?.headers?.get(header);
	return forwarded?.split(",")[0].trim() || "unknown";
}

export function assertSameOrigin(request: any) {
	if (process.env.NODE_ENV === "test") return;
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(request.url).origin) throw "INVALID_ORIGIN";
}
