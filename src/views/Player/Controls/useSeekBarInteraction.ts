import type { MutableRefObject, RefObject } from "react";
import { useCallback, useEffect } from "react";
import { SKIP_POINTS } from "./useMediaPlaybackState";

interface UseSeekBarInteractionOptions {
	progressRef: RefObject<HTMLDivElement | null>;
	draggingRef: MutableRefObject<boolean>;
	playerRef: any;
	currentTime: number;
	seekPosition: (position: number) => void;
}

/**
 * Handles mouse, touch, and keyboard seek interactions on the playback progress bar.
 */
export function useSeekBarInteraction({
	progressRef,
	draggingRef,
	playerRef,
	currentTime,
	seekPosition,
}: UseSeekBarInteractionOptions) {
	const handlePosEvent = useCallback(
		(e: any) => {
			// Extract clientX from either mouse or touch event
			const clientX =
				e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
			if (!draggingRef.current || !clientX) {
				return;
			}
			const progressElement = progressRef.current;
			if (!progressElement) return;
			const width = progressElement.clientWidth;
			const coord = clientX - progressElement.getBoundingClientRect().left;
			const ratio = playerRef.duration / width;
			let position = coord * ratio;
			if (position < 0) {
				position = 0;
			}
			if (position >= playerRef.duration) {
				position = playerRef.duration;
			}
			seekPosition(position);
		},
		[playerRef, seekPosition, draggingRef, progressRef],
	);

	useEffect(() => {
		const handleUpEvent = (e: any) => {
			handlePosEvent(e);
			draggingRef.current = false;
		};

		// Wrapper for touch events to prevent default only when dragging
		const handleTouchMove = (e: any) => {
			if (draggingRef.current) {
				e.preventDefault();
				handlePosEvent(e);
			}
		};

		const handleTouchEnd = (e: any) => {
			if (draggingRef.current) {
				e.preventDefault();
				handleUpEvent(e);
			}
		};

		// Add both mouse and touch event listeners
		document.addEventListener("mousemove", handlePosEvent);
		document.addEventListener("mouseup", handleUpEvent);
		document.addEventListener("touchmove", handleTouchMove, { passive: false });
		document.addEventListener("touchend", handleTouchEnd, { passive: false });
		return () => {
			document.removeEventListener("mousemove", handlePosEvent);
			document.removeEventListener("mouseup", handleUpEvent);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
		};
	}, [handlePosEvent, draggingRef]);

	return {
		onMouseDown(e: any) {
			draggingRef.current = true;
			handlePosEvent(e);
		},
		onTouchStart(e: any) {
			// Don't call preventDefault here - it's handled in document-level listeners
			draggingRef.current = true;
			handlePosEvent(e);
		},
		onKeyDown(e: any) {
			const duration = playerRef.duration;
			if (!duration) return;

			let newPos = currentTime;
			let changed = false;

			switch (e.key) {
				case "ArrowLeft":
				case "ArrowDown":
					newPos = Math.max(0, currentTime - SKIP_POINTS);
					changed = true;
					break;
				case "ArrowRight":
				case "ArrowUp":
					newPos = Math.min(duration, currentTime + SKIP_POINTS);
					changed = true;
					break;
				case "Home":
					newPos = 0;
					changed = true;
					break;
				case "End":
					newPos = duration;
					changed = true;
					break;
			}

			if (changed) {
				e.preventDefault();
				seekPosition(newPos);
			}
		},
		onContextMenu(e: any) {
			e.preventDefault(); // Prevent right-click menu
		},
	};
}
