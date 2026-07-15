const DEFAULT_PRODUCTION_SITE_URL = "https://systemconcepts.app";

function getProductionHostnames() {
	const defaultHostname = new URL(DEFAULT_PRODUCTION_SITE_URL).hostname;
	const hostnames = new Set([defaultHostname, `www.${defaultHostname}`]);
	const siteUrl =
		process.env.SITE_URL ||
		process.env.NEXT_PUBLIC_SITE_URL ||
		DEFAULT_PRODUCTION_SITE_URL;

	try {
		const hostname = new URL(siteUrl).hostname;
		hostnames.add(hostname);
		hostnames.add(`www.${hostname}`);
	} catch {
		// Keep the canonical production hostname available when configuration is invalid.
	}

	return hostnames;
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
