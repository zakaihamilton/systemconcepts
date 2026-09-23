const VERSION = "systemconcepts-v2";
const PAGE_CACHE = `${VERSION}-pages`;
const SESSION_CACHE = `${VERSION}-sessions`;

interface CacheHandle {
	add(request: RequestInfo | URL): Promise<void>;
	match(request: RequestInfo | URL): Promise<Response | undefined>;
	put(request: RequestInfo | URL, response: Response): Promise<void>;
}

interface CacheStorageHandle {
	open(name: string): Promise<CacheHandle>;
	keys(): Promise<string[]>;
	delete(name: string): Promise<boolean>;
	match(request: RequestInfo | URL): Promise<Response | undefined>;
}

interface ExtendableEventHandle {
	waitUntil(promise: PromiseLike<unknown>): void;
}

interface FetchEventHandle extends ExtendableEventHandle {
	request: Request;
	respondWith(response: Response | Promise<Response | undefined>): void;
}

interface ServiceWorkerScopeHandle {
	addEventListener(
		type: "install" | "activate",
		listener: (event: ExtendableEventHandle) => void,
	): void;
	addEventListener(
		type: "fetch",
		listener: (event: FetchEventHandle) => void,
	): void;
	location: { origin: string };
	skipWaiting(): Promise<void>;
}

const worker = self as unknown as ServiceWorkerScopeHandle;
const cacheStorage = (globalThis as unknown as { caches: CacheStorageHandle })
	.caches;

worker.addEventListener("install", (event) => {
	event.waitUntil(
		cacheStorage.open(PAGE_CACHE).then((cache) => cache.add("/~offline")),
	);
	worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
	event.waitUntil(
		cacheStorage
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(key) =>
								key.startsWith("systemconcepts-") && !key.startsWith(VERSION),
						)
						.map((key) => cacheStorage.delete(key)),
				),
			),
	);
	// Do not claim clients here. Taking over a frozen Android Chrome tab on
	// activate is a known renderer crash; the next navigation picks up the worker.
});

async function staleWhileRevalidate(
	request: Request,
	cacheName: string,
): Promise<Response | undefined> {
	const cache = await cacheStorage.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request).then((response) => {
		const cacheControl = response.headers.get("cache-control") || "";
		if (response.ok && !/\bno-store\b/i.test(cacheControl)) {
			void cache.put(request, response.clone());
		}
		return response;
	});
	return cached || network;
}

worker.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== worker.location.origin) return;
	if (url.pathname === "/api/player") return;
	if (url.pathname === "/api/sessions") {
		event.respondWith(staleWhileRevalidate(request, SESSION_CACHE));
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(() => cacheStorage.match("/~offline")),
		);
	}
});
