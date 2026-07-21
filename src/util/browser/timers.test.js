import { renderHook } from "@testing-library/react";
import { useInterval, useTimeout } from "./timers";

describe("useInterval", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("invokes the callback repeatedly at the given delay", () => {
		const callback = jest.fn();
		renderHook(() => useInterval(callback, 100));

		jest.advanceTimersByTime(300);
		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("does not schedule anything when delay is falsy", () => {
		const callback = jest.fn();
		renderHook(() => useInterval(callback, 0));

		jest.advanceTimersByTime(1000);
		expect(callback).not.toHaveBeenCalled();
	});

	it("always calls the latest callback without resetting the interval", () => {
		const first = jest.fn();
		const second = jest.fn();
		const { rerender } = renderHook(
			({ callback }) => useInterval(callback, 100),
			{ initialProps: { callback: first } },
		);

		jest.advanceTimersByTime(100);
		expect(first).toHaveBeenCalledTimes(1);

		rerender({ callback: second });
		jest.advanceTimersByTime(100);
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).toHaveBeenCalledTimes(1);
	});

	it("clears the interval on unmount", () => {
		const callback = jest.fn();
		const { unmount } = renderHook(() => useInterval(callback, 100));
		unmount();
		jest.advanceTimersByTime(500);
		expect(callback).not.toHaveBeenCalled();
	});

	it("restarts the interval when depends change", () => {
		const callback = jest.fn();
		const { rerender } = renderHook(
			({ dep }) => useInterval(callback, 100, [dep]),
			{
				initialProps: { dep: "a" },
			},
		);
		jest.advanceTimersByTime(50);
		rerender({ dep: "b" });
		jest.advanceTimersByTime(50);
		expect(callback).not.toHaveBeenCalled();
		jest.advanceTimersByTime(50);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});

describe("useTimeout", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("invokes the callback once after the given delay", () => {
		const callback = jest.fn();
		renderHook(() => useTimeout(callback, 100));

		jest.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("does not schedule anything when delay is falsy", () => {
		const callback = jest.fn();
		renderHook(() => useTimeout(callback, 0));

		jest.advanceTimersByTime(1000);
		expect(callback).not.toHaveBeenCalled();
	});

	it("clears the timeout on unmount", () => {
		const callback = jest.fn();
		const { unmount } = renderHook(() => useTimeout(callback, 100));
		unmount();
		jest.advanceTimersByTime(500);
		expect(callback).not.toHaveBeenCalled();
	});

	it("calls the latest callback reference", () => {
		const first = jest.fn();
		const second = jest.fn();
		const { rerender } = renderHook(
			({ callback }) => useTimeout(callback, 100),
			{ initialProps: { callback: first } },
		);
		rerender({ callback: second });
		jest.advanceTimersByTime(100);
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
	});

	it("restarts the timeout when depends change", () => {
		const callback = jest.fn();
		const { rerender } = renderHook(
			({ dep }) => useTimeout(callback, 100, [dep]),
			{
				initialProps: { dep: "a" },
			},
		);
		jest.advanceTimersByTime(50);
		rerender({ dep: "b" });
		jest.advanceTimersByTime(50);
		expect(callback).not.toHaveBeenCalled();
		jest.advanceTimersByTime(50);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
