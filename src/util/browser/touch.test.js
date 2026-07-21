import { renderHook } from "@testing-library/react";
import { useSwipe } from "./touch";

function touchEvent(x, y) {
	return { targetTouches: [{ clientX: x, clientY: y }] };
}

describe("useSwipe", () => {
	it("detects a left swipe", () => {
		const onSwipeLeft = jest.fn();
		const onSwipeRight = jest.fn();
		const { result } = renderHook(() =>
			useSwipe({ onSwipeLeft, onSwipeRight }),
		);

		result.current.onTouchStart(touchEvent(100, 0));
		result.current.onTouchMove(touchEvent(0, 0));
		result.current.onTouchEnd();

		expect(onSwipeLeft).toHaveBeenCalled();
		expect(onSwipeRight).not.toHaveBeenCalled();
	});

	it("detects a right swipe", () => {
		const onSwipeLeft = jest.fn();
		const onSwipeRight = jest.fn();
		const { result } = renderHook(() =>
			useSwipe({ onSwipeLeft, onSwipeRight }),
		);

		result.current.onTouchStart(touchEvent(0, 0));
		result.current.onTouchMove(touchEvent(100, 0));
		result.current.onTouchEnd();

		expect(onSwipeRight).toHaveBeenCalled();
		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it("detects an upward swipe", () => {
		const onSwipeUp = jest.fn();
		const onSwipeDown = jest.fn();
		const { result } = renderHook(() => useSwipe({ onSwipeUp, onSwipeDown }));

		result.current.onTouchStart(touchEvent(0, 100));
		result.current.onTouchMove(touchEvent(0, 0));
		result.current.onTouchEnd();

		expect(onSwipeUp).toHaveBeenCalled();
		expect(onSwipeDown).not.toHaveBeenCalled();
	});

	it("detects a downward swipe", () => {
		const onSwipeUp = jest.fn();
		const onSwipeDown = jest.fn();
		const { result } = renderHook(() => useSwipe({ onSwipeUp, onSwipeDown }));

		result.current.onTouchStart(touchEvent(0, 0));
		result.current.onTouchMove(touchEvent(0, 100));
		result.current.onTouchEnd();

		expect(onSwipeDown).toHaveBeenCalled();
		expect(onSwipeUp).not.toHaveBeenCalled();
	});

	it("ignores movement below the threshold", () => {
		const onSwipeLeft = jest.fn();
		const { result } = renderHook(() =>
			useSwipe({ onSwipeLeft, threshold: 50 }),
		);

		result.current.onTouchStart(touchEvent(20, 0));
		result.current.onTouchMove(touchEvent(0, 0));
		result.current.onTouchEnd();

		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it("does nothing without a completed start and end", () => {
		const onSwipeLeft = jest.fn();
		const { result } = renderHook(() => useSwipe({ onSwipeLeft }));

		expect(() => result.current.onTouchEnd()).not.toThrow();
		expect(onSwipeLeft).not.toHaveBeenCalled();
	});

	it("does not throw when the matching handler is not provided", () => {
		const { result } = renderHook(() => useSwipe({}));

		result.current.onTouchStart(touchEvent(100, 0));
		result.current.onTouchMove(touchEvent(0, 0));
		expect(() => result.current.onTouchEnd()).not.toThrow();
	});

	it("prefers horizontal detection when horizontal movement dominates", () => {
		const onSwipeLeft = jest.fn();
		const onSwipeDown = jest.fn();
		const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeDown }));

		result.current.onTouchStart(touchEvent(100, 30));
		result.current.onTouchMove(touchEvent(0, 0));
		result.current.onTouchEnd();

		expect(onSwipeLeft).toHaveBeenCalled();
		expect(onSwipeDown).not.toHaveBeenCalled();
	});
});
