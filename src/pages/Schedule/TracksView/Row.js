import React, { useRef, useEffect, useMemo, useCallback, forwardRef } from 'react';
import styles from './Row.module.scss';
import TrackCard from './Card';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { FixedSizeList } from "react-window";
import { useDateFormatter } from "@util/locale";
import { GroupsStore } from "@util/groups";
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ScheduleStore } from "@pages/Schedule";

const InnerList = forwardRef(({ style, ...rest }, ref) => (
    <div
        ref={ref}
        style={{
            ...style,
            width: parseFloat(style.width) + 24
        }}
        {...rest}
    />
));

export default function TrackRow({ date, sessions, focusedSessionId, onSessionClick, width = 0, itemSize = 350, store, translations = {}, playingSession }) {
    const listRef = useRef(null);
    const outerRef = useRef(null);
    const dateFormatter = useDateFormatter({ year: 'numeric', month: 'long' });
    const dateObj = useMemo(() => {
        const [y, m] = date.split('-');
        return new Date(y, parseInt(m) - 1, 1);
    }, [date]);
    const formattedDate = useMemo(() => {
        return dateFormatter.format(dateObj);
    }, [dateObj, dateFormatter]);

    const groups = GroupsStore.useState(s => s.groups);
    const showBadges = ScheduleStore.useState(s => s.showBadges);

    const toggleBadges = (e) => {
        e.stopPropagation();
        ScheduleStore.update(s => {
            s.showBadges = !s.showBadges;
        });
    };

    const groupCounts = useMemo(() => {
        const counts = {};
        sessions.forEach(session => {
            counts[session.group] = (counts[session.group] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => {
            const groupMetadata = groups.find(g => g.name === name) || {};
            return {
                name,
                count,
                color: groupMetadata.color
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [sessions, groups]);

    const handleHeaderClick = () => {
        if (store) {
            store.update(s => {
                s.lastViewMode = s.viewMode;
                s.viewMode = "month";
                s.date = dateObj;
            });
        }
    };
    const safeWidth = typeof width === "number" && width > 0 ? width : 0;

    // Scroll to focused item
    useEffect(() => {
        if (focusedSessionId && outerRef.current) {
            const index = sessions.findIndex(s => s.id === focusedSessionId);
            if (index !== -1) {
                const itemLeft = index * itemSize;
                const itemRight = itemLeft + itemSize;
                const scrollLeft = outerRef.current.scrollLeft;
                const clientWidth = outerRef.current.clientWidth;

                if (itemLeft < scrollLeft) {
                    outerRef.current.scrollTo({ left: itemLeft, behavior: 'smooth' });
                }
                else if (itemRight > scrollLeft + clientWidth) {
                    outerRef.current.scrollTo({ left: itemRight - clientWidth, behavior: 'smooth' });
                }
            }
        }
    }, [focusedSessionId, sessions, itemSize]);

    // Memoize itemData to prevent unnecessary re-renders
    const itemData = useMemo(() => ({
        sessions,
        focusedSessionId,
        onSessionClick,
        playingSession
    }), [sessions, focusedSessionId, onSessionClick, playingSession]);

    // Memoize RowItem component
    const RowItem = useCallback(({ index, style, data }) => {
        const { sessions, focusedSessionId, onSessionClick, playingSession } = data;
        const session = sessions[index];
        const newStyle = {
            ...style,
            left: (parseFloat(style.left) || 0) + 24
        };
        const isPlaying = playingSession && playingSession.name === session.name && playingSession.group === session.group && playingSession.date === session.date;
        return (
            <div style={newStyle} className={styles.cardContainer}>
                <TrackCard
                    session={session}
                    isActive={session.id === focusedSessionId}
                    onSessionClick={onSessionClick}
                    isPlaying={isPlaying}
                />
            </div>
        );
    }, []);

    // Check for overflow to conditionally show indicator
    const hasOverflow = (sessions.length * itemSize + 24) > safeWidth;

    return (
        <div className={styles.row}>
            <div className={styles.header}>
                <Typography variant="h6" className={styles.dateTitle} onClick={handleHeaderClick}>
                    {formattedDate}
                </Typography>
                <div className={styles.badges}>
                    {showBadges && groupCounts.map(group => (
                        <Tooltip key={group.name} title={group.name.charAt(0).toUpperCase() + group.name.slice(1)} arrow>
                            <div
                                className={styles.badge}
                                style={{ '--badge-bg': group.color || '#888' }}
                            >
                                {group.count}
                            </div>
                        </Tooltip>
                    ))}
                    <Tooltip title={showBadges ? translations.HIDE_GROUP_COUNTERS : translations.SHOW_GROUP_COUNTERS} arrow>
                        <IconButton className={styles.toggleButton} onClick={toggleBadges} size="small">
                            {showBadges ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                        </IconButton>
                    </Tooltip>
                </div>
            </div>
            <div className={styles.lane}>
                {safeWidth > 0 && (
                    <FixedSizeList
                        height={itemSize * (9 / 16) + 20}
                        itemCount={sessions.length}
                        itemSize={itemSize}
                        layout="horizontal"
                        width={safeWidth}
                        ref={listRef}
                        outerRef={outerRef}
                        className={styles.horizontalList}
                        itemData={itemData}
                        innerElementType={InnerList}
                        initialScrollOffset={parseInt(sessionStorage.getItem(`track_scroll_${date}`) || "0")}
                        onScroll={({ scrollOffset }) => {
                            sessionStorage.setItem(`track_scroll_${date}`, scrollOffset);
                        }}
                    >
                        {RowItem}
                    </FixedSizeList>
                )}
                {hasOverflow && <div className={styles.scrollIndicator} />}
            </div>
        </div>
    );
}
