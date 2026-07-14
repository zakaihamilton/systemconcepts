const DEFAULT_PRODUCTION_SITE_URL = "https://systemconcepts.app";

function getProductionHostnames() {
	const siteUrl =
		process.env.SITE_URL ||
		process.env.NEXT_PUBLIC_SITE_URL ||
		DEFAULT_PRODUCTION_SITE_URL;

	try {
		const hostname = new URL(siteUrl).hostname;
		return new Set([hostname, `www.${hostname}`]);
	} catch {
		return new Set([new URL(DEFAULT_PRODUCTION_SITE_URL).hostname]);
	}
}

export function isProductionDeployment(request) {
	if (process.env.VERCEL_ENV === "production") return true;

	const host = request?.headers?.get("host")?.split(":")[0];
	if (!host) return false;

	return getProductionHostnames().has(host);
}

export function shouldRedirectStorageFileRead(request, query = {}) {
	if (request.method !== "GET") return false;
	if (!isProductionDeployment(request)) return false;

	const exists = query.exists || request.headers.get("exists");
	const type = query.type || request.headers.get("type");

	return !exists && type !== "dir";
}
