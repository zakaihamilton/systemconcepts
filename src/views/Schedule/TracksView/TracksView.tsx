import { ContentSize } from "@components/Page/Content";
import { registerToolbar } from "@components/Toolbar";
import FixedSizeList from "@components/Virtualized/FixedSizeList";
import { useDeviceType } from "@util/browser/styles";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import TrackRow from "./Row";
import styles from "./TracksView.module.css";
import { useTracksDateToolbar } from "./useTracksDateToolbar";
import { useTracksKeyboardNav } from "./useTracksKeyboardNav";

registerToolbar("TracksView");

const CARD_WIDTH = 260;
const ROW_HEIGHT = 210;

export default function TracksView({
	sessions = [],
	store,
	translations,
	playingSession,
}: any) {
	const isMobile = useDeviceType() !== "desktop";
	const listRef = useRef<any>(null);
	const outerRef = useRef<any>(null);
	const pageSize = useContext(ContentSize);

	// Group sessions by month (year-month)
	const groupedSessions = useMemo(() => {
		const groups: Record<string, any[]> = {};
		sessions.forEach((session: any) => {
			if (!session.date) {
				return;
			}
			const parts = session.date.split("-");
			if (parts.length < 2) {
				return;
			}
			const [year, month] = parts;
			if (isNaN(parseInt(year)) || isNaN(parseInt(month))) {
				return;
			}
			const yearMonth = `${year}-${month}`;
			if (!groups[yearMonth]) {
				groups[yearMonth] = [];
			}
			groups[yearMonth].push(session);
		});

		// Sort year-months descending and sort sessions within each group descending by date
		return Object.keys(groups)
			.sort((a, b) => b.localeCompare(a))
			.map((yearMonth) => ({
				yearMonth,
				sessions: groups[yearMonth].sort((a: any, b: any) =>
					b.date.localeCompare(a.date),
				),
			}));
	}, [sessions]);

	const { focusedSessionId, handleSessionClick } = useTracksKeyboardNav({
		sessions,
		groupedSessions,
		outerRef,
		rowHeight: ROW_HEIGHT,
	});

	const { onItemsRendered } = useTracksDateToolbar({
		groupedSessions,
		listRef,
		outerRef,
		translations,
		isMobile,
	});

	const itemData = useMemo(
		() => ({
			groupedSessions,
			focusedSessionId,
			handleSessionClick,
			width: pageSize && pageSize.width ? pageSize.width : 0,
			itemSize: CARD_WIDTH,
			store,
			translations,
			playingSession,
		}),
		[
			groupedSessions,
			focusedSessionId,
			handleSessionClick,
			pageSize,
			store,
			translations,
			playingSession,
		],
	);

	const [initialScrollOffset] = useState(() =>
		parseInt(sessionStorage.getItem("tracks_vertical_offset") || "0"),
	);
	const scrollOffsetRef = useRef(initialScrollOffset);

	useEffect(() => {
		return () => {
			sessionStorage.setItem(
				"tracks_vertical_offset",
				String(scrollOffsetRef.current),
			);
		};
	}, []);

	if (!pageSize || !pageSize.width || !pageSize.height) return null;

	return (
		<div className={styles.root}>
			<FixedSizeList
				height={pageSize.height}
				itemCount={groupedSessions.length}
				itemSize={ROW_HEIGHT}
				width={pageSize.width}
				ref={listRef}
				outerRef={outerRef}
				overscanCount={2}
				className={styles.verticalList}
				style={{ overflowX: "hidden" }}
				itemData={itemData}
				onItemsRendered={onItemsRendered}
				initialScrollOffset={initialScrollOffset}
				onScroll={({ scrollOffset }: any) => {
					scrollOffsetRef.current = scrollOffset;
				}}
			>
				{Row}
			</FixedSizeList>
		</div>
	);
}

const Row = ({ index, style, data }: any) => {
	const {
		groupedSessions,
		focusedSessionId,
		handleSessionClick,
		width,
		itemSize,
		store,
		translations,
		playingSession,
	} = data;
	const group = groupedSessions[index];

	return (
		<div style={style}>
			<TrackRow
				key={group.yearMonth}
				date={group.yearMonth}
				sessions={group.sessions}
				focusedSessionId={focusedSessionId}
				onSessionClick={handleSessionClick}
				width={width}
				itemSize={itemSize}
				store={store}
				translations={translations}
				playingSession={playingSession}
			/>
		</div>
	);
};
