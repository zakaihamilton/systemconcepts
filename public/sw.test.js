import fs from "node:fs";
import path from "node:path";

const worker = fs.readFileSync(
	path.join(process.cwd(), "public/sw.js"),
	"utf8",
);

describe("native service worker", () => {
	it("defines the offline fallback and scoped API caching rules", () => {
		expect(worker).toContain('cache.add("/~offline")');
		expect(worker).toContain('url.pathname === "/api/player"');
		expect(worker).toContain('url.pathname === "/api/sessions"');
		expect(worker).toContain(
			'url.pathname === "/api/aws" || url.pathname === "/api/wasabi"',
		);
		expect(worker).toContain("staleWhileRevalidate(request, SESSION_CACHE)");
		expect(worker).toContain("staleWhileRevalidate(request, MEDIA_CACHE)");
	});

	it("does not depend on generated Workbox runtime code", () => {
		expect(worker).not.toMatch(/workbox|importScripts|precacheAndRoute/i);
	});
});
