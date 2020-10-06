import styles from "./MonthView.module.scss";
import Week from "./MonthView/Week";
import DayHeader from "./MonthView/DayHeader";
import { getMonthViewStart, addDate, getMonthNames, getYearNames } from "@/util/date";
import { useDateFormatter } from "@/util/locale";
import Input from "@/widgets/Input";

export default function MonthView({ date, store }) {
    const firstDay = getMonthViewStart(date);
    const dayHeaderFormatter = useDateFormatter({
        weekday: 'short'
    });
    const dayFormatter = useDateFormatter({
        day: 'numeric'
    });
    const monthFormatter = useDateFormatter({
        month: "long"
    });
    const yearFormatter = useDateFormatter({
        year: "numeric"
    });

    const month = addDate(firstDay, 15);

    const numWeeks = 6;
    const weeks = new Array(numWeeks).fill(0).map((_, index) => {
        const weekFirstDay = addDate(firstDay, index * 7);
        return <Week key={index} month={month} date={weekFirstDay} row={index + 2} dateFormatter={dayFormatter} />;
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        return <DayHeader key={index} date={day} index={index} dateFormatter={dayHeaderFormatter} />
    });

    const monthState = [month.getMonth() + 1, month => {
        store.update(s => {
            s.date = (new Date(date)).setMonth(month - 1);
        });
    }];
    const monthItems = getMonthNames(month, monthFormatter).map((name, index) => {
        return {
            id: index + 1,
            name
        };
    });
    const monthWidget = <Input select={true} fullWidth={false} style={{ marginLeft: "1em", marginRight: "1em", minWidth: "10em" }} items={monthItems} state={monthState} />;

    const yearState = [month.getFullYear(), year => {
        store.update(s => {
            s.date = (new Date(date)).setFullYear(year);
        });
    }];
    const yearStart = 2015;
    const yearItems = getYearNames(month, yearFormatter, yearStart, new Date().getFullYear() + 2).map((name, index) => {
        return {
            id: yearStart + index,
            name
        };
    });
    const yearWidget = <Input select={true} fullWidth={false} style={{ minWidth: "8em" }} items={yearItems} state={yearState} />;

    return <div className={styles.root}>
        <div className={styles.title}>
            {monthWidget}
            {yearWidget}
        </div>
        <div className={styles.grid}>
            {dayTitles}
            {weeks}
        </div>
    </div>
}
