import {
	clearFetchCache,
	fetchJSON,
	fetchText,
	getStableFetchCacheOptions,
} from "./fetch";

function mockResponse(body) {
	return Promise.resolve({
		status: 200,
		text: () => Promise.resolve(body),
	});
}

describe("fetch cache", () => {
	beforeEach(() => {
		clearFetchCache();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		clearFetchCache();
		jest.restoreAllMocks();
	});

	it("reuses cacheable JSON responses within the TTL", async () => {
		global.fetch.mockResolvedValue(mockResponse('{"ok":true}'));

		const options = getStableFetchCacheOptions(1000);
		const first = await fetchJSON("/api/sessions?id=user", options);
		const second = await fetchJSON("/api/sessions?id=user", options);

		expect(first).toEqual({ ok: true });
		expect(second).toEqual({ ok: true });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("does not cache responses unless explicitly requested", async () => {
		global.fetch
			.mockResolvedValueOnce(mockResponse("first"))
			.mockResolvedValueOnce(mockResponse("second"));

		await expect(fetchText("/api/login")).resolves.toBe("first");
		await expect(fetchText("/api/login")).resolves.toBe("second");

		expect(global.fetch).toHaveBeenCalledTimes(2);
	});
});
