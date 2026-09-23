import { act, renderHook } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import {
	useCounter,
	useHover,
	useLocalStorage,
	usePageVisibility,
	useUnique,
} from "./hooks";

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

describe("useCounter", () => {
	it("starts at the default value and increments", () => {
		const { result } = renderHook(() => useCounter());
		expect(result.current[0]).toBe(0);
		act(() => {
			result.current[1]();
		});
		expect(result.current[0]).toBe(1);
	});

	it("starts at the provided default value", () => {
		const { result } = renderHook(() => useCounter(5));
		expect(result.current[0]).toBe(5);
	});
});

describe("useHover", () => {
	it("keeps hover state false until a node is attached", () => {
		const { result } = renderHook(() => useHover());
		expect(result.current[1]).toBe(false);
	});

	it("tracks mouseenter and mouseleave on the attached node", () => {
		const { result } = renderHook(() => useHover());
		const [, initialValue] = result.current;
		expect(initialValue).toBe(false);

		const node = document.createElement("div");
		act(() => {
			result.current[0](node);
		});

		act(() => {
			node.dispatchEvent(new MouseEvent("mouseenter"));
		});
		expect(result.current[1]).toBe(true);

		act(() => {
			node.dispatchEvent(new MouseEvent("mouseleave"));
		});
		expect(result.current[1]).toBe(false);
	});

	it("detaches listeners from the previous node when the node changes", () => {
		const { result } = renderHook(() => useHover());
		const nodeA = document.createElement("div");
		const nodeB = document.createElement("div");

		act(() => {
			result.current[0](nodeA);
		});
		act(() => {
			result.current[0](nodeB);
		});

		act(() => {
			nodeA.dispatchEvent(new MouseEvent("mouseenter"));
		});
		expect(result.current[1]).toBe(false);

		act(() => {
			nodeB.dispatchEvent(new MouseEvent("mouseenter"));
		});
		expect(result.current[1]).toBe(true);
	});
});

describe("useUnique", () => {
	it("returns a stable id across re-renders", () => {
		const { result, rerender } = renderHook(() => useUnique());
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});

	it("returns different ids for different hook instances", () => {
		const { result: a } = renderHook(() => useUnique());
		const { result: b } = renderHook(() => useUnique());
		expect(a.current).not.toBe(b.current);
	});
});

describe("usePageVisibility", () => {
	let visibilityState = "visible";

	beforeAll(() => {
		Object.defineProperty(document, "visibilityState", {
			get: () => visibilityState,
			configurable: true,
		});
	});

	beforeEach(() => {
		visibilityState = "visible";
	});

	it("reflects the initial document visibility state", () => {
		visibilityState = "hidden";
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(false);
	});

	it("updates when the visibilitychange event fires", () => {
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(true);

		visibilityState = "hidden";
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current).toBe(false);

		visibilityState = "visible";
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current).toBe(true);
	});

	it("removes the listener on unmount", () => {
		const { result, unmount } = renderHook(() => usePageVisibility());
		unmount();
		visibilityState = "hidden";
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current).toBe(true);
	});
});

describe("useLocalStorage", () => {
	beforeEach(() => {
		window.localStorage.clear();
		jest.clearAllMocks();
	});

	it("returns the initial value when nothing is stored", () => {
		const { result } = renderHook(() => useLocalStorage("missing-key", "init"));
		expect(result.current[0]).toBe("init");
	});

	it("returns the parsed stored value", () => {
		window.localStorage.setItem("stored-key", JSON.stringify({ a: 1 }));
		const { result } = renderHook(() => useLocalStorage("stored-key", null));
		expect(result.current[0]).toEqual({ a: 1 });
	});

	it("falls back to the initial value and logs when parsing fails", () => {
		window.localStorage.setItem("bad-key", "{not-json");
		const { result } = renderHook(() => useLocalStorage("bad-key", "fallback"));
		expect(result.current[0]).toBe("fallback");
		expect(structuredLogger.debug).toHaveBeenCalled();
	});

	it("persists updates as JSON and updates the returned state", () => {
		const { result } = renderHook(() => useLocalStorage("persist-key", "init"));
		act(() => {
			result.current[1]("updated");
		});
		expect(result.current[0]).toBe("updated");
		expect(window.localStorage.getItem("persist-key")).toBe(
			JSON.stringify("updated"),
		);
	});

	it("supports a functional updater based on the previous value", () => {
		const { result } = renderHook(() => useLocalStorage("counter-key", 1));
		act(() => {
			result.current[1]((previous) => previous + 1);
		});
		expect(result.current[0]).toBe(2);
		expect(window.localStorage.getItem("counter-key")).toBe("2");
	});

	it("logs and swallows errors when persisting fails", () => {
		const { result } = renderHook(() => useLocalStorage("error-key", "init"));
		const setItemSpy = jest
			.spyOn(window.localStorage.__proto__, "setItem")
			.mockImplementation(() => {
				throw new Error("quota exceeded");
			});

		act(() => {
			result.current[1]("new value");
		});

		expect(structuredLogger.debug).toHaveBeenCalled();
		setItemSpy.mockRestore();
	});

	it("returns the initial value during server-side rendering", () => {
		const originalWindow = global.window;
		// @ts-expect-error test shim
		delete global.window;
		const { result } = renderHook(() => useLocalStorage("ssr-key", "server"));
		expect(result.current[0]).toBe("server");
		global.window = originalWindow;
	});
});
