/**
 * Helper to parse S3 location strings.
 * Supports "bucket/key" or just "key" (uses default bucket).
 */
export function parseUrl(url: any) {
	if (!url) return [process.env.AWS_BUCKET, ""];
	const parts = url.split("/");
	if (parts.length > 1 && !url.startsWith("/")) {
		return [parts[0], parts.slice(1).join("/")];
	}
	return [process.env.AWS_BUCKET, url];
}

/**
 * Normalize path by removing leading slash
 */
export function normalizePath(path: any) {
	if (!path) return path;
	return path.startsWith("/") ? path.substring(1) : path;
}

/**
 * Validate path access to prevent traversal and restricted folder access
 */
export function validatePathAccess(path: any) {
	if (!path) return;

	const decoded = decodeURIComponent(path);
	const normalized = normalizePath(decoded).replace(/^\/+/, "");

	if (normalized.split("/").includes("..")) {
		throw new Error("ACCESS_DENIED");
	}

	if (normalized.startsWith("private/") || normalized === "private") {
		throw new Error("ACCESS_DENIED");
	}
}

/**
 * Normalize and authorize an object path used by the public session-content
 * endpoints. Those endpoints must never be able to read the personal sync
 * namespace merely because the caller has a student session.
 */
export function normalizeSessionContentPath(path: any) {
	if (typeof path !== "string" || !path) {
		throw new Error("ACCESS_DENIED");
	}

	let normalized;
	try {
		normalized = decodeURIComponent(path).replace(/^\/+/, "");
	} catch {
		throw new Error("ACCESS_DENIED");
	}

	if (normalized.startsWith("aws/")) {
		normalized = normalized.slice("aws/".length);
	}

	validatePathAccess(normalized);
	if (!normalized.startsWith("sessions/")) {
		throw new Error("ACCESS_DENIED");
	}
	return normalized;
}
