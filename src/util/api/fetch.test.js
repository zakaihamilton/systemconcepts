import { act, renderHook } from "@testing-library/react";
import {
	__resetReloginGuardForTests,
	clearFetchCache,
	fetchBlob,
	fetchJSON,
	fetchText,
	getStableFetchCacheOptions,
	useFetch,
	useFetchJSON,
} from "@util/api/fetch";
import { useOnline } from "@util/browser/online";
import Cookies from "js-cookie";

jest.mock("js-cookie");
jest.mock("@util/browser/online", () => ({ useOnline: jest.fn(() => true) }));

function mockResponse(body) {
	return Promise.resolve({
		status: 200,
		text: () => Promise.resolve(body),
	});
}

describe("fetch cache", () => {
	beforeEach(() => {
		clearFetchCache();
		__resetReloginGuardForTests();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		clearFetchCache();
		__resetReloginGuardForTests();
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

	it("redirects straight to account when already on an auth path", async () => {
		window.location.hash = "#account";
		global.fetch.mockResolvedValue({
			status: 401,
			text: () => Promise.resolve("{}"),
		});

		await expect(fetchJSON("/api/personal")).rejects.toBe(
			"AUTHENTICATION_REQUIRED",
		);

		expect(window.location.hash).toBe("#account");
	});

	it("only starts one redirect flow when two requests fail at the same time", async () => {
		window.location.hash = "#sessions/test";
		global.fetch.mockResolvedValue({
			status: 401,
			text: () => Promise.resolve("{}"),
		});

		const [first, second] = await Promise.allSettled([
			fetchJSON("/api/one"),
			fetchJSON("/api/two"),
		]);

		expect(first.status).toBe("rejected");
		expect(first.reason).toBe("AUTHENTICATION_REQUIRED");
		expect(second.status).toBe("rejected");
		// The second call is guarded and falls through to a plain status rejection.
		expect(second.reason).toBe(401);
	});

	it("rejects with the status code for non-200, non-401 JSON responses", async () => {
		global.fetch.mockResolvedValue({
			status: 500,
			text: () => Promise.resolve("Internal Error"),
		});
		await expect(fetchJSON("/api/broken")).rejects.toBe(500);
	});

	it("rejects when the underlying fetch call throws for JSON requests", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		await expect(fetchJSON("/api/broken")).rejects.toThrow("network down");
	});

	it("rejects when the JSON response body cannot be parsed", async () => {
		global.fetch.mockResolvedValue(mockResponse("{not-json"));
		await expect(fetchJSON("/api/broken")).rejects.toBeInstanceOf(SyntaxError);
	});

	it("rejects with the status code for non-200 text responses", async () => {
		global.fetch.mockResolvedValue({
			status: 404,
			text: () => Promise.resolve("not found"),
		});
		await expect(fetchText("/api/missing")).rejects.toBe(404);
	});

	it("rejects when the text response body cannot be parsed", async () => {
		global.fetch.mockResolvedValue({
			status: 200,
			text: () => Promise.reject(new Error("bad text")),
		});
		await expect(
			fetchText("/api/missing", getStableFetchCacheOptions(1000)),
		).rejects.toThrow("bad text");
	});

	it("reuses cacheable text responses within the TTL", async () => {
		global.fetch.mockResolvedValue(mockResponse("cached-text"));

		const options = getStableFetchCacheOptions(1000);
		const first = await fetchText("/api/text", options);
		const second = await fetchText("/api/text", options);

		expect(first).toBe("cached-text");
		expect(second).toBe("cached-text");
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("rejects when the underlying fetch call throws for text requests", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		await expect(fetchText("/api/missing")).rejects.toThrow("network down");
	});
});

describe("fetchBlob", () => {
	beforeEach(() => {
		__resetReloginGuardForTests();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		__resetReloginGuardForTests();
		jest.restoreAllMocks();
	});

	it("resolves with the blob body on success", async () => {
		const blob = new Blob(["hello"]);
		global.fetch.mockResolvedValue({
			status: 200,
			blob: () => Promise.resolve(blob),
		});
		await expect(fetchBlob("/api/file")).resolves.toBe(blob);
	});

	it("routes 401 responses through the relogin flow", async () => {
		window.location.hash = "#library";
		global.fetch.mockResolvedValue({ status: 401 });
		await expect(fetchBlob("/api/file")).rejects.toBe(
			"AUTHENTICATION_REQUIRED",
		);
	});

	it("rejects with the status code for non-200 responses", async () => {
		global.fetch.mockResolvedValue({ status: 500 });
		await expect(fetchBlob("/api/file")).rejects.toBe(500);
	});

	it("rejects when blob parsing fails", async () => {
		global.fetch.mockResolvedValue({
			status: 200,
			blob: () => Promise.reject(new Error("bad blob")),
		});
		await expect(fetchBlob("/api/file")).rejects.toThrow("bad blob");
	});

	it("rejects when the underlying fetch call throws", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		await expect(fetchBlob("/api/file")).rejects.toThrow("network down");
	});
});

describe("useFetchJSON", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		clearFetchCache();
		global.fetch = jest.fn();
		useOnline.mockReturnValue(true);
	});

	afterEach(() => {
		clearFetchCache();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("fetches JSON and reports progress and the result", async () => {
		global.fetch.mockResolvedValue(mockResponse('{"ok":true}'));
		const { result } = renderHook(() => useFetchJSON("/api/data"));

		expect(result.current[2]).toBe(true);

		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});

		expect(result.current[0]).toEqual({ ok: true });
		expect(result.current[2]).toBe(false);
		expect(result.current[3]).toBe("");
	});

	it("captures an error when the fetch fails", async () => {
		global.fetch.mockResolvedValue({
			status: 500,
			text: () => Promise.resolve("oops"),
		});
		const { result } = renderHook(() => useFetchJSON("/api/data"));

		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});

		expect(result.current[3]).toBe(500);
		expect(result.current[2]).toBe(false);
	});

	it("does not fetch when cond is false", () => {
		renderHook(() => useFetchJSON("/api/data", undefined, [], false));
		act(() => {
			jest.runOnlyPendingTimers();
		});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("clears pending timers when cond becomes false", () => {
		const { rerender } = renderHook(
			({ cond }) => useFetchJSON("/api/data", undefined, [], cond),
			{ initialProps: { cond: true } },
		);
		rerender({ cond: false });
		act(() => {
			jest.runOnlyPendingTimers();
		});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("does not fetch while offline", () => {
		useOnline.mockReturnValue(false);
		renderHook(() => useFetchJSON("/api/data"));
		act(() => {
			jest.runOnlyPendingTimers();
		});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("reload triggers another fetch", async () => {
		global.fetch.mockResolvedValue(mockResponse('{"ok":true}'));
		const { result } = renderHook(() => useFetchJSON("/api/data"));

		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});
		expect(global.fetch).toHaveBeenCalledTimes(1);

		act(() => {
			result.current[4]();
		});
		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("cleans up pending timers on unmount", () => {
		global.fetch.mockResolvedValue(mockResponse('{"ok":true}'));
		const { unmount } = renderHook(() => useFetchJSON("/api/data"));
		expect(() => unmount()).not.toThrow();
	});
});

describe("useFetch", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		clearFetchCache();
		global.fetch = jest.fn();
		useOnline.mockReturnValue(true);
	});

	afterEach(() => {
		clearFetchCache();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("fetches text and reports the result", async () => {
		global.fetch.mockResolvedValue(mockResponse("hello world"));
		const { result } = renderHook(() => useFetch("/api/text"));

		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});

		expect(result.current[0]).toBe("hello world");
		expect(result.current[2]).toBe(false);
	});

	it("does not fetch when no url is provided", () => {
		renderHook(() => useFetch(null));
		act(() => {
			jest.runOnlyPendingTimers();
		});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("captures errors and supports reload", async () => {
		global.fetch.mockResolvedValue({
			status: 500,
			text: () => Promise.resolve("oops"),
		});
		const { result } = renderHook(() => useFetch("/api/text"));

		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});

		expect(result.current[3]).toBe(500);
		act(() => {
			result.current[4]();
		});
		global.fetch.mockResolvedValue(mockResponse("again"));
		await act(async () => {
			jest.runOnlyPendingTimers();
			await Promise.resolve();
		});
		expect(result.current[0]).toBe("again");
	});

	it("clears timers when offline", () => {
		useOnline.mockReturnValue(false);
		const { unmount } = renderHook(() => useFetch("/api/text"));
		expect(() => unmount()).not.toThrow();
	});
});
