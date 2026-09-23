import { act, renderHook } from "@testing-library/react";
import { useMediaUrlRenewal } from "./useMediaUrlRenewal";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe("useMediaUrlRenewal", () => {
	it("renews on error and reports failure after three attempts across URL changes", () => {
		const renewUrl = jest.fn();
		const onLoadError = jest.fn();
		const { result, rerender } = renderHook(
			({ path }) =>
				useMediaUrlRenewal({
					path,
					renewUrl,
					renewing: false,
					onLoadError,
					sessionKey: "session-a",
					label: "Audio",
				}),
			{ initialProps: { path: "https://media.example/a?sig=1" } },
		);

		act(() => {
			result.current.onError();
		});
		expect(renewUrl).toHaveBeenCalledTimes(1);
		expect(result.current.recovering).toBe(true);

		rerender({ path: "https://media.example/a?sig=2" });
		act(() => {
			result.current.onError();
		});
		rerender({ path: "https://media.example/a?sig=3" });
		act(() => {
			result.current.onError();
		});
		rerender({ path: "https://media.example/a?sig=4" });
		act(() => {
			result.current.onError();
		});

		expect(renewUrl).toHaveBeenCalledTimes(3);
		expect(onLoadError).toHaveBeenCalledTimes(1);
		expect(result.current.recovering).toBe(false);
	});

	it("ignores duplicate errors while a renew is in flight", () => {
		const renewUrl = jest.fn();
		const { result } = renderHook(() =>
			useMediaUrlRenewal({
				path: "https://media.example/a",
				renewUrl,
				renewing: false,
				sessionKey: "session-a",
			}),
		);

		act(() => {
			result.current.onError();
			result.current.onError();
			result.current.onError();
		});

		expect(renewUrl).toHaveBeenCalledTimes(1);
	});

	it("clears recovering when renewing ends without a new URL", () => {
		const renewUrl = jest.fn();
		const { result, rerender } = renderHook(
			({ renewing, path }) =>
				useMediaUrlRenewal({
					path,
					renewUrl,
					renewing,
					sessionKey: "session-a",
				}),
			{
				initialProps: {
					renewing: false,
					path: "https://media.example/a?sig=1",
				},
			},
		);

		act(() => {
			result.current.onError();
		});
		expect(result.current.recovering).toBe(true);

		rerender({ renewing: true, path: "https://media.example/a?sig=1" });
		rerender({ renewing: false, path: "https://media.example/a?sig=1" });

		expect(result.current.recovering).toBe(false);
	});

	it("keeps recovering when renewing ends with a new URL until clearRecovery", () => {
		const renewUrl = jest.fn();
		const { result, rerender } = renderHook(
			({ renewing, path }) =>
				useMediaUrlRenewal({
					path,
					renewUrl,
					renewing,
					sessionKey: "session-a",
				}),
			{
				initialProps: {
					renewing: false,
					path: "https://media.example/a?sig=1",
				},
			},
		);

		act(() => {
			result.current.onError();
		});
		rerender({ renewing: true, path: "https://media.example/a?sig=1" });
		rerender({ renewing: false, path: "https://media.example/a?sig=2" });

		expect(result.current.recovering).toBe(true);

		act(() => {
			result.current.clearRecovery();
		});
		expect(result.current.recovering).toBe(false);
	});

	it("resets recovery when the session changes", () => {
		const renewUrl = jest.fn();
		const { result, rerender } = renderHook(
			({ sessionKey }) =>
				useMediaUrlRenewal({
					path: "https://media.example/a",
					renewUrl,
					renewing: false,
					sessionKey,
				}),
			{ initialProps: { sessionKey: "session-a" } },
		);

		act(() => {
			result.current.onError();
		});
		expect(result.current.recovering).toBe(true);

		rerender({ sessionKey: "session-b" });
		expect(result.current.recovering).toBe(false);

		act(() => {
			result.current.onError();
		});
		expect(renewUrl).toHaveBeenCalledTimes(2);
	});
});
