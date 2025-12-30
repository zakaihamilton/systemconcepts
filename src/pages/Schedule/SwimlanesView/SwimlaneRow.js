import React, { useRef, useEffect, useMemo, useCallback, forwardRef } from 'react';
import styles from './SwimlaneRow.module.scss';
import SwimlaneCard from './SwimlaneCard';
import Typography from '@mui/material/Typography';
import { FixedSizeList } from "react-window";
import { useDateFormatter } from "@util/locale";

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

export default function SwimlaneRow({ date, sessions, focusedSessionId, onSessionClick, width = 0, itemSize = 350, store }) {
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
        onSessionClick
    }), [sessions, focusedSessionId, onSessionClick]);

    // Memoize RowItem component
    const RowItem = useCallback(({ index, style, data }) => {
        const { sessions, focusedSessionId, onSessionClick } = data;
        const session = sessions[index];
        const newStyle = {
            ...style,
            left: (parseFloat(style.left) || 0) + 24
        };
        return (
            <div style={newStyle} className={styles.cardContainer}>
                <SwimlaneCard
                    session={session}
                    isActive={session.id === focusedSessionId}
                    onSessionClick={onSessionClick}
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
                        initialScrollOffset={parseInt(sessionStorage.getItem(`swimlane_scroll_${date}`) || "0")}
                        onScroll={({ scrollOffset }) => {
                            sessionStorage.setItem(`swimlane_scroll_${date}`, scrollOffset);
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
