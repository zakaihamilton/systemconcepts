/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const worker = fs.readFileSync(
	path.join(process.cwd(), "public/sw.js"),
	"utf8",
);
const origin = "https://systemconcepts.test";

function setup() {
	const listeners = new Map<string, (event: unknown) => void>();
	const responses = new Map<string, Response>();
	const cache = {
		addAll: jest.fn().mockResolvedValue(undefined),
		match: jest.fn(async (request: Request | string) =>
			responses.get(typeof request === "string" ? request : request.url),
		),
		put: jest.fn(async (request: Request, response: Response) => {
			responses.set(request.url, response);
		}),
		keys: jest.fn().mockResolvedValue([]),
		delete: jest.fn(),
	};
	const caches = {
		open: jest.fn().mockResolvedValue(cache),
		keys: jest.fn().mockResolvedValue([]),
		delete: jest.fn(),
	};
	const network = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
	class WorkerRequest extends Request {
		constructor(input: string | Request, options?: RequestInit) {
			super(
				typeof input === "string" ? new URL(input, origin) : input,
				options,
			);
		}
	}
	vm.runInNewContext(worker, {
		self: {
			location: { origin },
			addEventListener: (name: string, listener: (event: unknown) => void) =>
				listeners.set(name, listener),
		},
		caches,
		fetch: network,
		Request: WorkerRequest,
		URL,
	});
	function lifecycle(name: string) {
		let completion: Promise<unknown> = Promise.resolve();
		listeners.get(name)?.({
			waitUntil: (promise: Promise<unknown>) => {
				completion = promise;
			},
		});
		return completion;
	}
	function request(pathname: string, mode = "cors") {
		let response: Promise<Response> | undefined;
		const updates: Promise<unknown>[] = [];
		listeners.get("fetch")?.({
			request: { url: new URL(pathname, origin).href, method: "GET", mode },
			respondWith: (promise: Promise<Response>) => {
				response = promise;
			},
			waitUntil: (promise: Promise<unknown>) => updates.push(promise),
		});
		return { response, updates };
	}
	return { cache, caches, network, responses, lifecycle, request };
}

describe("native service worker", () => {
	it("installs the shell and propagates precache failures", async () => {
		const { cache, lifecycle } = setup();
		await lifecycle("install");
		const requests: Request[] = cache.addAll.mock.calls[0][0];
		expect(requests.map((request) => new URL(request.url).pathname)).toEqual(
			expect.arrayContaining([
				"/",
				"/~offline",
				"/noflash.js",
				"/icon.png",
				"/manifest.json",
			]),
		);
		expect(requests.every((request) => request.cache === "reload")).toBe(true);
		cache.addAll.mockRejectedValueOnce(new Error("Asset unavailable"));
		await expect(lifecycle("install")).rejects.toThrow("Asset unavailable");
	});

	it("serves the cached app shell for offline product deep links and the fallback for other documents", async () => {
		const { network, responses, request } = setup();
		network.mockRejectedValue(new TypeError("Offline"));
		responses.set("/", new Response("Application shell"));
		responses.set("/~offline", new Response("Offline fallback"));
		expect(
			await (await request("/?source=pwa", "navigate").response)?.text(),
		).toBe("Application shell");
		expect(await (await request("/unknown", "navigate").response)?.text()).toBe(
			"Offline fallback",
		);
	});

	it("loads cached dynamic chunks offline without intercepting authenticated APIs or media", async () => {
		const { responses, network, request } = setup();
		responses.set(
			`${origin}/_next/static/chunks/library.js`,
			new Response("Cached chunk"),
		);
		expect(
			await (await request("/_next/static/chunks/library.js").response)?.text(),
		).toBe("Cached chunk");
		expect(network).not.toHaveBeenCalled();
		for (const api of [
			"/api/player",
			"/api/player/media",
			"/api/personal",
			"/api/login",
			"/api/aws",
		])
			expect(request(api).response).toBeUndefined();
	});

	it("uses the network for session data and respects no-store", async () => {
		const { network, cache, request } = setup();
		network.mockResolvedValue(
			new Response("Private data", {
				headers: { "cache-control": "no-store" },
			}),
		);
		const result = request("/api/sessions?id=test");
		expect(await (await result.response)?.text()).toBe("Private data");
		await Promise.all(result.updates);
		expect(cache.put).not.toHaveBeenCalled();
	});

	it("removes only old app build caches on activation", async () => {
		const { caches, lifecycle } = setup();
		await lifecycle("install");
		const currentCache = caches.open.mock.calls[0][0];
		caches.keys.mockResolvedValue([
			"systemconcepts-v2-pages",
			currentCache,
			"other-app",
		]);
		await lifecycle("activate");
		expect(caches.delete).toHaveBeenCalledTimes(1);
		expect(caches.delete).toHaveBeenCalledWith("systemconcepts-v2-pages");
	});

	it("waits for existing clients to close before updating", () => {
		expect(worker).not.toMatch(/(?:self|worker)\.skipWaiting\(\)/);
		expect(worker).not.toContain("clients.claim()");
		expect(worker).not.toMatch(/workbox|importScripts|precacheAndRoute/i);
	});
});
