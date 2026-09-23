const VERSION = "systemconcepts-v2";
const PAGE_CACHE = `${VERSION}-pages`;
const SESSION_CACHE = `${VERSION}-sessions`;
const SESSION_CACHE_MAX_ENTRIES = 128;

interface CacheHandle {
	add(request: RequestInfo | URL): Promise<void>;
	match(request: RequestInfo | URL): Promise<Response | undefined>;
	put(request: RequestInfo | URL, response: Response): Promise<void>;
	keys(): Promise<Request[]>;
	delete(request: RequestInfo | URL): Promise<boolean>;
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

async function putSessionResponse(
	cache: CacheHandle,
	request: Request,
	response: Response,
): Promise<void> {
	await cache.put(request, response.clone());
	const requests = await cache.keys();
	const excess = requests.length - SESSION_CACHE_MAX_ENTRIES;
	if (excess > 0) {
		await Promise.all(
			requests.slice(0, excess).map((cached) => cache.delete(cached)),
		);
	}
}

function networkFirst(
	request: Request,
	cacheName: string,
	event: FetchEventHandle,
): Promise<Response> {
	const cachePromise = cacheStorage.open(cacheName);
	const network = fetch(request);
	const update = network
		.then(async (response) => {
			const cacheControl = response.headers.get("cache-control") || "";
			if (response.ok && !/\bno-store\b/i.test(cacheControl)) {
				const cache = await cachePromise;
				await putSessionResponse(cache, request, response);
			}
		})
		.catch(() => {});
	event.waitUntil(update);
	return network.catch(async (error) => {
		const cache = await cachePromise;
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	});
}

worker.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== worker.location.origin) return;
	if (url.pathname === "/api/player") return;
	if (url.pathname === "/api/sessions") {
		event.respondWith(networkFirst(request, SESSION_CACHE, event));
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(() => cacheStorage.match("/~offline")),
		);
	}
});
