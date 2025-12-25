import { useDateFormatter } from "@util/locale";
import styles from "./Month.module.scss";
import { getMonthViewStart, addDate, isDateMonth, isDateToday, getDateString } from "@util/date";
import clsx from "clsx";

export default function Month({ date, sessions, store }) {
    const monthFormatter = useDateFormatter({ month: "long" });
    const dayFormatter = useDateFormatter({ day: "numeric" });
    const monthName = monthFormatter.format(date);

    const start = getMonthViewStart(date);
    const numDays = 42;
    const days = new Array(numDays).fill(0).map((_, index) => {
        const dayDate = addDate(start, index);
        const isMonth = isDateMonth(dayDate, date);
        const isToday = isDateToday(dayDate);
        const dayLabel = dayFormatter.format(dayDate);
        const sessionDate = getDateString(dayDate);
        const hasSession = sessions && sessions.some(s => s.date === sessionDate);
        const onClick = () => {
            store.update(s => {
                s.date = dayDate;
                s.viewMode = "day";
                s.lastViewMode = "year";
            });
        };

        return <div key={index} className={clsx(styles.day, !isMonth && styles.otherMonth, isToday && styles.today, hasSession && styles.hasSession)} onClick={onClick}>
            {dayLabel}
        </div>;
    });

    const onClick = () => {
        store.update(s => {
            s.date = date;
            s.viewMode = "month";
            s.lastViewMode = "year";
        });
    };

    return <div className={styles.root}>
        <div className={styles.title} onClick={onClick}>{monthName}</div>
        <div className={styles.grid}>
            {days}
        </div>
    </div>;
}
