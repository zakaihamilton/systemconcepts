import { act, renderHook } from "@testing-library/react";
import { useOnline } from "./online";

describe("useOnline", () => {
	let originalOnLine;

	beforeAll(() => {
		originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
	});

	afterAll(() => {
		if (originalOnLine) {
			Object.defineProperty(navigator, "onLine", originalOnLine);
		}
	});

	function setOnline(value) {
		Object.defineProperty(navigator, "onLine", {
			value,
			configurable: true,
		});
	}

	it("reflects the initial navigator.onLine value", () => {
		setOnline(true);
		const { result } = renderHook(() => useOnline());
		expect(result.current).toBe(true);
	});

	it("updates to true when an online event fires", () => {
		setOnline(false);
		const { result } = renderHook(() => useOnline());
		expect(result.current).toBe(false);

		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		expect(result.current).toBe(true);
	});

	it("updates to false when an offline event fires", () => {
		setOnline(true);
		const { result } = renderHook(() => useOnline());
		expect(result.current).toBe(true);

		act(() => {
			window.dispatchEvent(new Event("offline"));
		});
		expect(result.current).toBe(false);
	});

	it("removes its listeners on unmount", () => {
		setOnline(true);
		const { result, unmount } = renderHook(() => useOnline());
		unmount();
		act(() => {
			window.dispatchEvent(new Event("offline"));
		});
		expect(result.current).toBe(true);
	});
});
