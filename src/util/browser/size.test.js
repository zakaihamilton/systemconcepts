import { act, renderHook } from "@testing-library/react";
import {
	getEmValueFromElement,
	useResize,
	useSize,
	useWindowSize,
} from "./size";

describe("getEmValueFromElement", () => {
	it("returns 16 when the element has no parent", () => {
		const element = document.createElement("div");
		expect(getEmValueFromElement(element)).toBe(16);
	});

	it("returns 16 when no element is provided", () => {
		expect(getEmValueFromElement(null)).toBe(16);
	});

	it("computes the pixel value of one em relative to the parent font size", () => {
		const parent = document.createElement("div");
		parent.style.fontSize = "10px";
		const child = document.createElement("span");
		child.style.fontSize = "20px";
		parent.appendChild(child);
		document.body.appendChild(parent);

		expect(getEmValueFromElement(child)).toBeCloseTo(40);

		document.body.removeChild(parent);
	});
});

describe("useResize", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("increments the counter after mount and sets viewport CSS variables", () => {
		const { result } = renderHook(() => useResize());
		expect(result.current).toBe(0);

		act(() => {
			jest.advanceTimersByTime(0);
		});

		expect(result.current).toBe(1);
		expect(document.documentElement.style.getPropertyValue("--vh")).not.toBe(
			"",
		);
		expect(document.documentElement.style.getPropertyValue("--vw")).not.toBe(
			"",
		);
	});

	it("debounces rapid resize events into a single update", () => {
		const { result } = renderHook(() => useResize());
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(result.current).toBe(1);

		act(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("resize"));
		});
		act(() => {
			jest.advanceTimersByTime(200);
		});

		expect(result.current).toBe(2);
	});

	it("restarts the resize listener when depends change", () => {
		const { result, rerender } = renderHook(
			({ depends }) => useResize(depends),
			{
				initialProps: { depends: ["a"] },
			},
		);
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(result.current).toBe(1);

		rerender({ depends: ["b"] });
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(result.current).toBe(2);
	});

	it("cleans up timers and listeners on unmount", () => {
		const { unmount } = renderHook(() => useResize());
		expect(() => unmount()).not.toThrow();
	});
});

describe("useWindowSize", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("returns the current window dimensions", () => {
		const { result } = renderHook(() => useWindowSize());
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(result.current).toEqual({
			width: window.innerWidth,
			height: window.innerHeight,
		});
	});
});

describe("useSize", () => {
	let instances;

	class ResizeObserverMock {
		constructor(callback) {
			this.callback = callback;
			this.observe = jest.fn();
			this.unobserve = jest.fn();
			this.disconnect = jest.fn();
			instances.push(this);
		}
	}

	beforeEach(() => {
		jest.useFakeTimers();
		instances = [];
		global.ResizeObserver = ResizeObserverMock;
	});

	afterEach(() => {
		jest.useRealTimers();
		delete global.ResizeObserver;
	});

	it("returns default size fields when no ref is provided", () => {
		const { result } = renderHook(() => useSize());
		expect(result.current).toEqual({ width: 0, height: 0, emPixels: 16 });
	});

	it("returns default size fields when the ref has no current element", () => {
		const ref = { current: null };
		const { result } = renderHook(() => useSize(ref));
		expect(result.current.width).toBe(0);
		expect(result.current.height).toBe(0);
		expect(result.current.ref).toBe(ref);
	});

	it("measures the element immediately on mount", () => {
		const element = document.createElement("div");
		element.getBoundingClientRect = () => ({ width: 100, height: 50 });
		const ref = { current: element };

		const { result } = renderHook(() => useSize(ref));

		expect(result.current.width).toBe(100);
		expect(result.current.height).toBe(50);
		expect(instances[0].observe).toHaveBeenCalledWith(element);
	});

	it("re-measures when the resize observer reports a change", () => {
		const element = document.createElement("div");
		let rect = { width: 100, height: 50 };
		element.getBoundingClientRect = () => rect;
		const ref = { current: element };

		const { result } = renderHook(() => useSize(ref));
		expect(result.current.width).toBe(100);

		// Settle useResize's own initial timer before exercising the observer.
		act(() => {
			jest.advanceTimersByTime(0);
		});

		rect = { width: 200, height: 80 };
		act(() => {
			instances[0].callback();
			jest.advanceTimersByTime(100);
		});

		expect(result.current.width).toBe(200);
		expect(result.current.height).toBe(80);
	});

	it("ignores resize observer changes below the meaningful threshold", () => {
		const element = document.createElement("div");
		let rect = { width: 100, height: 50 };
		element.getBoundingClientRect = () => rect;
		const ref = { current: element };

		const { result } = renderHook(() => useSize(ref));
		expect(result.current.width).toBe(100);

		// Settle useResize's own initial timer before exercising the observer.
		act(() => {
			jest.advanceTimersByTime(0);
		});

		rect = { width: 100.5, height: 50.5 };
		act(() => {
			instances[0].callback();
			jest.advanceTimersByTime(100);
		});

		expect(result.current.width).toBe(100);
		expect(result.current.height).toBe(50);
	});

	it("unobserves the element on unmount", () => {
		const element = document.createElement("div");
		element.getBoundingClientRect = () => ({ width: 10, height: 10 });
		const ref = { current: element };

		const { unmount } = renderHook(() => useSize(ref));
		unmount();

		expect(instances[0].unobserve).toHaveBeenCalledWith(element);
	});

	it("cancels pending resize timers when unmounting during a debounced resize", () => {
		const element = document.createElement("div");
		element.getBoundingClientRect = () => ({ width: 100, height: 50 });
		const ref = { current: element };

		const { unmount } = renderHook(() => useSize(ref));
		act(() => {
			instances[0].callback();
		});
		expect(() => unmount()).not.toThrow();
	});

	it("returns a ref handle when a ref is provided", () => {
		const element = document.createElement("div");
		element.getBoundingClientRect = () => ({ width: 10, height: 10 });
		const ref = { current: element };

		const { result } = renderHook(() => useSize(ref));

		expect(result.current.ref).toBe(ref);
		expect(result.current.counter).toBeDefined();
	});

	it("cancels an in-flight animation frame during rapid resize events", () => {
		const cancelSpy = jest.spyOn(window, "cancelAnimationFrame");
		const { result } = renderHook(() => useResize());
		act(() => {
			jest.advanceTimersByTime(0);
		});
		expect(result.current).toBe(1);

		act(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("resize"));
		});

		expect(cancelSpy).toHaveBeenCalled();
		cancelSpy.mockRestore();
	});
});
