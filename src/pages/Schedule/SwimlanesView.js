import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from "react";
import styles from "./SwimlanesView.module.scss";
import SwimlaneRow from "./SwimlanesView/SwimlaneRow";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import { useDeviceType } from "@util/styles";
import { addPath } from "@util/pages";
import { FixedSizeList } from "react-window";
import { ContentSize } from "@components/Page/Content";
import Input from "@components/Widgets/Input";
import { useDateFormatter } from "@util/locale";
import TodayIcon from '@mui/icons-material/Today';
import { getDateString, isDateToday } from "@util/date";

registerToolbar("SwimlanesView");

export default function SwimlanesView({ sessions = [], loading, store, translations, viewModes }) {
    const isMobile = useDeviceType() !== "desktop";
    const [focusedSessionId, setFocusedSessionId] = useState(null);
    const listRef = useRef(null);
    const outerRef = useRef(null);
    const pageSize = useContext(ContentSize);
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedDay, setSelectedDay] = useState("");
    const dateFormatter = useDateFormatter({ month: "long" });

    // Dimensions
    // Card width target: ~320px
    const CARD_WIDTH = 320;
    const ROW_HEIGHT = 270; // Header + Card Height + Padding

    // Group sessions by date
    const groupedSessions = useMemo(() => {
        const groups = {};
        sessions.forEach(session => {
            const date = session.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(session);
        });

        // Sort dates descending
        return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => ({
            date,
            sessions: groups[date]
        }));
    }, [sessions]);

    // Extract available years/months/days
    const dateOptions = useMemo(() => {
        const years = new Set();
        const monthsByYear = {}; // { 2023: Set(01, 02) }
        const daysByYearMonth = {}; // { 2023-01: Set(01, 02) }

        groupedSessions.forEach(group => {
            const [y, m, d] = group.date.split('-');
            years.add(y);

            if (!monthsByYear[y]) monthsByYear[y] = new Set();
            monthsByYear[y].add(m);

            const ym = `${y}-${m}`;
            if (!daysByYearMonth[ym]) daysByYearMonth[ym] = new Set();
            daysByYearMonth[ym].add(d);
        });

        return {
            years: Array.from(years).sort((a, b) => b.localeCompare(a)),
            monthsByYear,
            daysByYearMonth
        };
    }, [groupedSessions]);

    // Sync footer with scrolling
    const onItemsRendered = useCallback(({ visibleStartIndex }) => {
        if (visibleStartIndex >= 0 && visibleStartIndex < groupedSessions.length) {
            const date = groupedSessions[visibleStartIndex].date;
            const [y, m, d] = date.split('-');

            // Only update if changed to prevent unnecessary renders/loops
            setSelectedYear(prev => prev !== y ? y : prev);
            setSelectedMonth(prev => prev !== m ? m : prev);
            setSelectedDay(prev => prev !== d ? d : prev);
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

    const scrollToDate = (year, month, day) => {
        let prefix = `${year}`;
        if (month) prefix += `-${month}`;
        if (day) prefix += `-${day}`;

        const index = groupedSessions.findIndex(g => g.date.startsWith(prefix));
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
        setSelectedDay("");
        scrollToDate(year, "", "");
    }];

    const monthState = [selectedMonth, (month) => {
        setSelectedMonth(month);
        setSelectedDay("");
        if (selectedYear) {
            scrollToDate(selectedYear, month, "");
        }
    }];

    const dayState = [selectedDay, (day) => {
        setSelectedDay(day);
        if (selectedYear && selectedMonth) {
            scrollToDate(selectedYear, selectedMonth, day);
        }
    }];

    // Automatically select the newest year available on init if not set
    useEffect(() => {
        // Only run if NO year is selected, to avoid overwriting scroll sync
        if (selectedYear === "" && dateOptions.years.length > 0) {
            const firstGroup = groupedSessions[0];
            if (firstGroup) {
                const [y, m, d] = firstGroup.date.split('-');
                setSelectedYear(y);
                setSelectedMonth(m);
                setSelectedDay(d);
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

    const availableDays = useMemo(() => {
        const key = `${selectedYear}-${selectedMonth}`;
        if (!selectedYear || !selectedMonth || !dateOptions.daysByYearMonth[key]) return [];
        return Array.from(dateOptions.daysByYearMonth[key]).sort((a, b) => b.localeCompare(a));
    }, [selectedYear, selectedMonth, dateOptions]);

    const dayItems = [
        ...availableDays.map(d => ({ id: d, name: d }))
    ];

    const yearWidget = <Input select={true} label={translations.YEAR} helperText="" fullWidth={false} style={{ minWidth: "6em" }} items={yearItems} state={yearState} />;
    const monthWidget = <Input select={true} label={translations.MONTH} helperText="" fullWidth={false} style={{ minWidth: "8em" }} items={monthItems} state={monthState} disabled={!selectedYear} />;
    const dayWidget = <Input select={true} label={translations.DAY} helperText="" fullWidth={false} style={{ minWidth: "5em" }} items={dayItems} state={dayState} disabled={!selectedMonth} />;

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
            id: "dayWidget",
            element: dayWidget,
            location: "footer"
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
    ].filter(Boolean);

    useToolbar({ id: "SwimlanesView", items: toolbarItems, depends: [translations, selectedYear, selectedMonth, selectedDay, isMobile, isAtTop] });

    const itemData = useMemo(() => ({
        groupedSessions,
        focusedSessionId,
        handleSessionClick,
        width: (pageSize && pageSize.width ? pageSize.width - 18 : 0),
        itemSize: CARD_WIDTH
    }), [groupedSessions, focusedSessionId, handleSessionClick, pageSize?.width, CARD_WIDTH]);

    const scrollOffsetRef = useRef(parseInt(sessionStorage.getItem("swimlanes_vertical_offset") || "0"));

    useEffect(() => {
        return () => {
            sessionStorage.setItem("swimlanes_vertical_offset", scrollOffsetRef.current);
        };
    }, []);

    if (!pageSize || !pageSize.width || !pageSize.height) return null;

    return (
        <div className={styles.root}>
            <FixedSizeList
                height={pageSize.height}
                itemCount={groupedSessions.length}
                itemSize={ROW_HEIGHT}
                width={pageSize.width - 18}
                ref={listRef}
                outerRef={outerRef}
                overscanCount={2}
                className={styles.verticalList}
                style={{ overflowX: 'hidden' }}
                itemData={itemData}
                onItemsRendered={onItemsRendered}
                initialScrollOffset={scrollOffsetRef.current}
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
    const { groupedSessions, focusedSessionId, handleSessionClick, width, itemSize } = data;
    const group = groupedSessions[index];

    return (
        <div style={style}>
            <SwimlaneRow
                key={group.date}
                date={group.date}
                sessions={group.sessions}
                focusedSessionId={focusedSessionId}
                onSessionClick={handleSessionClick}
                width={width}
                itemSize={itemSize}
            />
        </div>
    );
};
