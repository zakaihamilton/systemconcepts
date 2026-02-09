import { useDateFormatter } from "@util/locale";
import styles from "./Month.module.scss";
import { getMonthViewStart, addDate, isDateMonth, isDateToday, getDateString } from "@util/date";
import clsx from "clsx";
import { useTranslations } from "@util/translations";
import Tooltip from "@mui/material/Tooltip";

import ViewWeekIcon from "@mui/icons-material/ViewWeek";
export default function Month({ date, sessions, store, playingSession }) {
    const translations = useTranslations();
    const monthFormatter = useDateFormatter({ month: "long" });
    const dayFormatter = useDateFormatter({ day: "numeric" });
    const monthName = monthFormatter.format(date);

    const start = getMonthViewStart(date);
    const items = new Array(6).fill(0).map((_, weekIndex) => {
        const weekDate = addDate(start, weekIndex * 7);
        const onWeekClick = () => {
            store.update(s => {
                s.date = weekDate;
                s.viewMode = "week";
                s.lastViewMode = "year";
            });
        };
        const weekIndicator = <Tooltip key={`week-${weekIndex}`} title={translations.WEEK_VIEW} disableInteractive>
            <span>
                <div className={styles.weekIndicator} onClick={onWeekClick}>
                    <ViewWeekIcon fontSize="inherit" />
                </div>
            </span>
        </Tooltip>;

        const weekDays = new Array(7).fill(0).map((_, dayIndex) => {
            const dayDate = addDate(weekDate, dayIndex);
            const isMonth = isDateMonth(dayDate, date);
            const isToday = isDateToday(dayDate);
            const dayLabel = dayFormatter.format(dayDate);
            const sessionDate = getDateString(dayDate);
            const hasSession = sessions && sessions.some(s => s.date === sessionDate);
            const isPlaying = sessions && sessions.some(s => s.date === sessionDate && s.name === playingSession);
            const onClick = () => {
                store.update(s => {
                    s.date = dayDate;
                    s.viewMode = "day";
                    s.lastViewMode = "year";
                });
            };

            return <div key={`day-${weekIndex}-${dayIndex}`} className={clsx(styles.day, !isMonth && styles.otherMonth, isToday && styles.today, hasSession && styles.hasSession, isPlaying && styles.playing)} onClick={onClick}>
                {dayLabel}
            </div>;
        });
        return [weekIndicator, ...weekDays];
    }).flat();

    const onClick = () => {
        store.update(s => {
            s.date = date;
            s.viewMode = "month";
            s.lastViewMode = "year";
        });
    };

    return <div className={styles.root}>
        <Tooltip title={translations.MONTH_VIEW} disableInteractive>
            <span>
                <div className={styles.title} onClick={onClick}>{monthName}</div>
            </span>
        </Tooltip>
        <div className={styles.grid}>
            {items}
        </div>
    </div>;
}
