import { useState, useMemo, useEffect, useCallback, useRef, useContext } from "react";
import styles from "./TracksView.module.scss";
import TrackRow from "./TracksView/Row";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import { useDeviceType } from "@util/styles";
import { addPath } from "@util/pages";
import { FixedSizeList } from "react-window";
import { ContentSize } from "@components/Page/Content";
import Input from "@components/Widgets/Input";
import { useDateFormatter } from "@util/locale";
import TodayIcon from '@mui/icons-material/Today';

registerToolbar("TracksView");

export default function TracksView({ sessions = [], store, translations, playingSession }) {
    const isMobile = useDeviceType() !== "desktop";
    const [focusedSessionId, setFocusedSessionId] = useState(null);
    const listRef = useRef(null);
    const outerRef = useRef(null);
    const pageSize = useContext(ContentSize);
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const dateFormatter = useDateFormatter({ month: "long" });

    // Dimensions
    // Card width target: ~320px
    const CARD_WIDTH = 260;
    const ROW_HEIGHT = 210; // Header + Card Height + Padding

    // Group sessions by month (year-month)
    const groupedSessions = useMemo(() => {
        const groups = {};
        sessions.forEach(session => {
            if (!session.date) {
                return;
            }
            const parts = session.date.split('-');
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
        return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(yearMonth => ({
            yearMonth,
            sessions: groups[yearMonth].sort((a, b) => b.date.localeCompare(a.date))
        }));
    }, [sessions]);

    // Extract available years/months
    const dateOptions = useMemo(() => {
        const years = new Set();
        const monthsByYear = {}; // { 2023: Set(01, 02) }

        groupedSessions.forEach(group => {
            const [y, m] = group.yearMonth.split('-');
            years.add(y);

            if (!monthsByYear[y]) monthsByYear[y] = new Set();
            monthsByYear[y].add(m);
        });

        return {
            years: Array.from(years).sort((a, b) => b.localeCompare(a)),
            monthsByYear
        };
    }, [groupedSessions]);

    // Sync footer with scrolling
    const onItemsRendered = useCallback(({ visibleStartIndex }) => {
        if (visibleStartIndex >= 0 && visibleStartIndex < groupedSessions.length) {
            const yearMonth = groupedSessions[visibleStartIndex].yearMonth;
            const [y, m] = yearMonth.split('-');

            // Only update if changed to prevent unnecessary renders/loops
            setSelectedYear(prev => prev !== y ? y : prev);
            setSelectedMonth(prev => prev !== m ? m : prev);
        }
    }, [groupedSessions]);

    // Helper to find current indices
    const findIndices = useCallback((id) => {
        for (let i = 0; i < groupedSessions.length; i++) {
            const row = groupedSessions[i];
            const sessionIndex = row.sessions.findIndex(s => s.id === id);
            if (sessionIndex !== -1) {
                return { rowIndex: i, sessionIndex };
            }
        }
        return null;
    }, [groupedSessions]);

    // Navigation Logic
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.repeat) return;
            if (!sessions.length) return;

            // If no focus, focus first item on any arrow key
            if (!focusedSessionId) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
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
                case 'ArrowRight':
                    if (sessionIndex < groupedSessions[rowIndex].sessions.length - 1) {
                        nextSessionIndex++;
                    }
                    else {
                        e.preventDefault();
                        return; // Stop at end of row
                    }
                    break;
                case 'ArrowLeft':
                    if (sessionIndex > 0) {
                        nextSessionIndex--;
                    }
                    else {
                        e.preventDefault();
                        return; // Stop at start of row
                    }
                    break;
                case 'ArrowDown':
                    if (rowIndex < groupedSessions.length - 1) {
                        nextRowIndex++;
                        // Try to maintain relative horizontal position, or clamp
                        const nextRowLen = groupedSessions[nextRowIndex].sessions.length;
                        nextSessionIndex = Math.min(sessionIndex, nextRowLen - 1);
                    }
                    break;
                case 'ArrowUp':
                    if (rowIndex > 0) {
                        nextRowIndex--;
                        // Try to maintain relative horizontal position, or clamp
                        const pendingNextRowLen = groupedSessions[nextRowIndex].sessions.length;
                        nextSessionIndex = Math.min(sessionIndex, pendingNextRowLen - 1);
                    }
                    break;
                case 'Enter': {
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
                const nextSession = groupedSessions[nextRowIndex].sessions[nextSessionIndex];
                if (nextSession) {
                    setFocusedSessionId(nextSession.id);
                    // Scroll vertical list if changing rows
                    if (nextRowIndex !== rowIndex && outerRef.current) {
                        const itemTop = nextRowIndex * ROW_HEIGHT;
                        const itemBottom = itemTop + ROW_HEIGHT;
                        const scrollTop = outerRef.current.scrollTop;
                        const clientHeight = outerRef.current.clientHeight;

                        if (itemTop < scrollTop) {
                            outerRef.current.scrollTo({ top: itemTop, behavior: 'smooth' });
                        } else if (itemBottom > scrollTop + clientHeight) {
                            outerRef.current.scrollTo({ top: itemBottom - clientHeight, behavior: 'smooth' });
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedSessionId, groupedSessions, sessions.length, findIndices]);

    const handleSessionClick = useCallback((session) => {
        setFocusedSessionId(session.id);
        const itemPath = `session?group=${session.group}&year=${session.year}&date=${session.date}&name=${encodeURIComponent(session.name)}`;
        addPath(itemPath);
    }, []);

    const scrollToDate = (year, month) => {
        let prefix = `${year}`;
        if (month) prefix += `-${month}`;

        const index = groupedSessions.findIndex(g => g.yearMonth.startsWith(prefix));
        if (index !== -1 && listRef.current) {
            listRef.current.scrollToItem(index, "start");
        }
    };

    const gotoToday = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollToItem(0, "start");
        }
    }, []);

    // State handlers for Input widget
    const yearState = [selectedYear, (year) => {
        setSelectedYear(year);
        setSelectedMonth("");
        scrollToDate(year, "");
    }];

    const monthState = [selectedMonth, (month) => {
        setSelectedMonth(month);
        if (selectedYear) {
            scrollToDate(selectedYear, month);
        }
    }];

    // Automatically select the newest year available on init if not set
    useEffect(() => {
        // Only run if NO year is selected, to avoid overwriting scroll sync
        if (selectedYear === "" && dateOptions.years.length > 0) {
            const firstGroup = groupedSessions[0];
            if (firstGroup) {
                const [y, m] = firstGroup.yearMonth.split('-');
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedYear(y);
                setSelectedMonth(m);
            }
        }
    }, [dateOptions.years, selectedYear, groupedSessions]);

    const yearItems = dateOptions.years.map(y => ({ id: y, name: y }));

    const availableMonths = useMemo(() => {
        if (!selectedYear || !dateOptions.monthsByYear[selectedYear]) return [];
        return Array.from(dateOptions.monthsByYear[selectedYear])
            .sort((a, b) => b.localeCompare(a))
            .map(m => {
                const date = new Date(parseInt(selectedYear), parseInt(m) - 1, 1);
                return { id: m, name: dateFormatter.format(date) };
            });
    }, [selectedYear, dateOptions, dateFormatter]);

    const monthItems = [
        ...availableMonths
    ];

    const yearWidget = <Input select={true} label={translations.YEAR} helperText="" fullWidth={false} style={{ minWidth: "6em" }} items={yearItems} state={yearState} />;
    const monthWidget = <Input select={true} label={translations.MONTH} helperText="" fullWidth={false} style={{ minWidth: "8em" }} items={monthItems} state={monthState} disabled={!selectedYear} />;

    // Disable Today button when already at the top of the list
    const [isAtTop, setIsAtTop] = useState(true);

    useEffect(() => {
        const checkScrollPosition = () => {
            if (outerRef.current) {
                setIsAtTop(outerRef.current.scrollTop === 0);
            }
        };

        // Check initially and on scroll
        checkScrollPosition();

        const handleScroll = () => checkScrollPosition();
        const scrollElement = outerRef.current;
        if (scrollElement) {
            scrollElement.addEventListener('scroll', handleScroll);
            return () => scrollElement.removeEventListener('scroll', handleScroll);
        }
    }, []);

    const toolbarItems = [
        {
            id: "today",
            name: translations.TODAY,
            icon: <TodayIcon />,
            onClick: gotoToday,
            disabled: isAtTop,
            location: "header",
            menu: false
        },
        {
            id: "monthWidget",
            element: monthWidget,
            location: "footer"
        },
        {
            id: "yearWidget",
            element: yearWidget,
            location: "footer"
        }
    ];

    useToolbar({ id: "TracksView", items: toolbarItems, depends: [translations, selectedYear, selectedMonth, isMobile, isAtTop] });

    // eslint-disable-next-line
    const itemData = useMemo(() => ({
        groupedSessions,
        focusedSessionId,
        handleSessionClick,
        width: (pageSize && pageSize.width ? pageSize.width : 0),
        itemSize: CARD_WIDTH,
        store,
        translations,
        playingSession
    }), [groupedSessions, focusedSessionId, handleSessionClick, pageSize?.width, CARD_WIDTH, store, translations, playingSession]);

    const [initialScrollOffset] = useState(() => {
        if (typeof window !== "undefined") {
            return parseInt(sessionStorage.getItem("tracks_vertical_offset") || "0");
        }
        return 0;
    });
    const scrollOffsetRef = useRef(initialScrollOffset);

    useEffect(() => {
        return () => {
            sessionStorage.setItem("tracks_vertical_offset", scrollOffsetRef.current);
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
                style={{ overflowX: 'hidden' }}
                itemData={itemData}
                onItemsRendered={onItemsRendered}
                initialScrollOffset={initialScrollOffset}
                onScroll={({ scrollOffset }) => {
                    scrollOffsetRef.current = scrollOffset;
                }}
            >
                {Row}
            </FixedSizeList>
        </div>
    );
}

const Row = ({ index, style, data }) => {
    const { groupedSessions, focusedSessionId, handleSessionClick, width, itemSize, store, translations, playingSession } = data;
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
