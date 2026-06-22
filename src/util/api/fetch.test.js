import {
	clearFetchCache,
	fetchJSON,
	fetchText,
	getStableFetchCacheOptions,
} from "@util/api/fetch";
import Cookies from "js-cookie";

jest.mock("js-cookie");

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

	it("reuses cached null JSON responses within the TTL", async () => {
		global.fetch.mockResolvedValue(mockResponse(""));

		const options = getStableFetchCacheOptions(1000);
		const first = await fetchJSON("/api/empty", options);
		const second = await fetchJSON("/api/empty", options);

		expect(first).toBeNull();
		expect(second).toBeNull();
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

	it("routes expired sessions through login and preserves the return path", async () => {
		window.location.hash = "#sessions/test";
		global.fetch.mockResolvedValue({
			status: 401,
			text: () => Promise.resolve('{"err":"Please sign in again"}'),
		});

		await expect(fetchJSON("/api/personal")).rejects.toBe(
			"AUTHENTICATION_REQUIRED",
		);

		expect(Cookies.remove).toHaveBeenCalledWith("id", { path: "/" });
		expect(Cookies.remove).toHaveBeenCalledWith("hash", { path: "/" });
		expect(window.location.hash).toBe("#account?redirect=sessions%2Ftest");
	});
});
