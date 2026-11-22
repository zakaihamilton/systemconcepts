import { addPath } from "@util/domain/views";
import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

interface TrackMonthGroup {
	yearMonth: string;
	sessions: any[];
}

interface UseTracksKeyboardNavOptions {
	sessions: any[];
	groupedSessions: TrackMonthGroup[];
	outerRef: RefObject<HTMLDivElement | null>;
	rowHeight: number;
}

/**
 * Manages arrow-key and Enter navigation across month-grouped session tracks.
 */
export function useTracksKeyboardNav({
	sessions,
	groupedSessions,
	outerRef,
	rowHeight,
}: UseTracksKeyboardNavOptions) {
	const [focusedSessionId, setFocusedSessionId] = useState<any>(null);

	const findIndices = useCallback(
		(id: any) => {
			for (let i = 0; i < groupedSessions.length; i++) {
				const row = groupedSessions[i];
				const sessionIndex = row.sessions.findIndex((s: any) => s.id === id);
				if (sessionIndex !== -1) {
					return { rowIndex: i, sessionIndex };
				}
			}
			return null;
		},
		[groupedSessions],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (!sessions.length) return;

			// If no focus, focus first item on any arrow key
			if (!focusedSessionId) {
				if (
					["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
				) {
					e.preventDefault();
					if (groupedSessions[0]?.sessions[0]) {
						setFocusedSessionId(groupedSessions[0].sessions[0].id);
					}
				}
				return;
			}

			const current = findIndices(focusedSessionId);
			if (!current) return;

			const { rowIndex, sessionIndex } = current;
			let nextRowIndex = rowIndex;
			let nextSessionIndex = sessionIndex;

			switch (e.key) {
				case "ArrowRight":
					if (sessionIndex < groupedSessions[rowIndex].sessions.length - 1) {
						nextSessionIndex++;
					} else {
						e.preventDefault();
						return; // Stop at end of row
					}
					break;
				case "ArrowLeft":
					if (sessionIndex > 0) {
						nextSessionIndex--;
					} else {
						e.preventDefault();
						return; // Stop at start of row
					}
					break;
				case "ArrowDown":
					if (rowIndex < groupedSessions.length - 1) {
						nextRowIndex++;
						const nextRowLen = groupedSessions[nextRowIndex].sessions.length;
						nextSessionIndex = Math.min(sessionIndex, nextRowLen - 1);
					}
					break;
				case "ArrowUp":
					if (rowIndex > 0) {
						nextRowIndex--;
						const pendingNextRowLen =
							groupedSessions[nextRowIndex].sessions.length;
						nextSessionIndex = Math.min(sessionIndex, pendingNextRowLen - 1);
					}
					break;
				case "Enter": {
					e.preventDefault();
					const session = groupedSessions[rowIndex].sessions[sessionIndex];
					const itemPath = `session?group=${session.group}&year=${session.year}&date=${session.date}&name=${encodeURIComponent(session.name)}`;
					addPath(itemPath);
					return;
				}
				default:
					return;
			}

			if (nextRowIndex !== rowIndex || nextSessionIndex !== sessionIndex) {
				e.preventDefault();
				const nextSession =
					groupedSessions[nextRowIndex].sessions[nextSessionIndex];
				if (nextSession) {
					setFocusedSessionId(nextSession.id);
					// Scroll vertical list if changing rows
					if (nextRowIndex !== rowIndex && outerRef.current) {
						const itemTop = nextRowIndex * rowHeight;
						const itemBottom = itemTop + rowHeight;
						const scrollTop = outerRef.current.scrollTop;
						const clientHeight = outerRef.current.clientHeight;

						if (itemTop < scrollTop) {
							outerRef.current.scrollTo({ top: itemTop, behavior: "smooth" });
						} else if (itemBottom > scrollTop + clientHeight) {
							outerRef.current.scrollTo({
								top: itemBottom - clientHeight,
								behavior: "smooth",
							});
						}
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		focusedSessionId,
		groupedSessions,
		sessions.length,
		findIndices,
		outerRef,
		rowHeight,
	]);

	const handleSessionClick = useCallback((session: any) => {
		setFocusedSessionId(session.id);
		const itemPath = `session?group=${session.group}&year=${session.year}&date=${session.date}&name=${encodeURIComponent(session.name)}`;
		addPath(itemPath);
	}, []);

	return {
		focusedSessionId,
		handleSessionClick,
	};
}
