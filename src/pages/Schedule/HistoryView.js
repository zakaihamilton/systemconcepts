import { useMemo, useCallback } from "react";
import { useTranslations } from "@util/translations";
import styles from "./HistoryView.module.scss";
import { useRecentHistory } from "@util/history";
import { useSessions, SessionsStore } from "@util/sessions";
import { PlayerStore } from "@pages/Player";
import { addPath } from "@util/pages";
import { isDateToday, diffDays } from "@util/date";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import Tooltip from "@mui/material/Tooltip";
import { useSearch } from "@components/Search";
import TrackCard from "@pages/Schedule/TracksView/Card";

export default function HistoryView() {
    const translations = useTranslations();
    const [history, , , , removeFromHistory] = useRecentHistory();
    const { session } = PlayerStore.useState();

    const itemPath = useCallback(item => {
        return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
    }, []);

    const gotoItem = useCallback(item => {
        addPath(itemPath(item));
    }, [itemPath]);

    const [sessions] = useSessions([], { filterSessions: true, skipSync: true, active: false, showToolbar: false });
    const { yearFilter } = SessionsStore.useState();
    const search = useSearch("schedule");

    const groupedHistory = useMemo(() => {
        if (!history || !sessions) return [];

        const groups = {
            TODAY: [],
            YESTERDAY: [],
            THIS_WEEK: [],
            LAST_WEEK: [],
            OLDER: []
        };

        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfWeek.getDate() - 7);

        let filteredHistory = [...history];

        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            filteredHistory = filteredHistory.filter(item => {
                const session = sessions.find(s => s.group === item.group && s.date === item.date && s.name === item.name);
                const name = (session ? session.name : item.name).toLowerCase();
                const group = (session ? session.group : item.group).toLowerCase();
                return name.includes(searchLower) || group.includes(searchLower);
            });
        }

        // Apply year filter
        if (yearFilter.length > 0) {
            filteredHistory = filteredHistory.filter(item => {
                const session = sessions.find(s => s.group === item.group && s.date === item.date && s.name === item.name);
                return session && yearFilter.includes(session.year);
            });
        }

        filteredHistory.forEach(item => {
            if (!item.group || !item.name || !item.date) {
                return;
            }

            // Find session metadata
            const session = sessions.find(s => s.group === item.group && s.date === item.date && s.name === item.name);
            if (!session) {
                return;
            }
            item = { ...item, ...session };

            const date = new Date(item.timestamp || 0);
            if (isDateToday(date)) {
                groups.TODAY.push(item);
            } else if (diffDays(date, today) === 1) {
                groups.YESTERDAY.push(item);
            } else if (date >= startOfWeek) {
                groups.THIS_WEEK.push(item);
            } else if (date >= startOfLastWeek) {
                groups.LAST_WEEK.push(item);
            } else {
                groups.OLDER.push(item);
            }
        });

        return Object.entries(groups).filter(([, items]) => items.length > 0).map(([key, items]) => ({
            id: key,
            name: translations[key],
            items
        }));
    }, [history, translations, sessions, search]);

    return (
        <div className={styles.historyView}>
            {groupedHistory.map(group => (
                <div key={group.id} className={styles.group}>
                    <div className={styles.groupHeader}>{group.name}</div>
                    <div className={styles.groupItems}>
                        {group.items.map(item => {
                            const isPlaying = session && session.group === item.group && session.date === item.date && session.name === item.name;

                            return (
                                <div
                                    key={item.key || `${item.group}-${item.date}-${item.name}-${item.timestamp}`}
                                    className={styles.timelineEntry}
                                    style={{ "--dot-color": item.color || "var(--neutral-400)" }}
                                >
                                    <div className={styles.timelineHeader} onClick={() => gotoItem(item)}>
                                        <div className={styles.timelineInfo}>
                                            <div className={styles.timelineDot} />
                                            <span className={styles.timelineTime}>
                                                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                            </span>
                                        </div>
                                        <div className={styles.actions}>
                                            <Tooltip title={translations.REMOVE_FROM_HISTORY}>
                                                <IconButton
                                                    className={styles.removeButton}
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFromHistory(item);
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="inherit" />
                                                </IconButton>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    <div className={styles.cardContainer}>
                                        <TrackCard
                                            session={item}
                                            isPlaying={isPlaying}
                                            onSessionClick={() => gotoItem(item)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
