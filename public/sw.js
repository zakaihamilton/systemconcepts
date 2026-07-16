const VERSION = "systemconcepts-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const SESSION_CACHE = `${VERSION}-sessions`;
const MEDIA_CACHE = `${VERSION}-media`;

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.add("/~offline")));
	self.skipWaiting();
});
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key.startsWith("systemconcepts-") && !key.startsWith(VERSION)).map((key) => caches.delete(key))),
		),
	);
	self.clients.claim();
});
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request).then((response) => {
		if (response.ok) cache.put(request, response.clone());
		return response;
	});
	return cached || network;
}
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== self.location.origin) return;
	if (url.pathname === "/api/player") return;
	if (url.pathname === "/api/sessions") {
		event.respondWith(staleWhileRevalidate(request, SESSION_CACHE));
		return;
	}
	if ((url.pathname === "/api/aws" || url.pathname === "/api/wasabi") && /(?:^|&)path=(?:%2F)?sessions%2F/i.test(url.search.slice(1))) {
		event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(fetch(request).catch(() => caches.match("/~offline")));
	}
});
