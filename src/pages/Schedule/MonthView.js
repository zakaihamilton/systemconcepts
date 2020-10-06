import styles from "./MonthView.module.scss";
import Week from "./MonthView/Week";
import DayHeader from "./MonthView/DayHeader";
import { getSunday, addDate } from "@/util/date";
import { useDateFormatter } from "@/util/locale";

export default function MonthView({ date }) {
    const firstDay = getSunday(date);
    const dateFormatter = useDateFormatter({
        weekday: 'short'
    });

    const numWeeks = 6;
    const weeks = new Array(numWeeks).fill(0).map((_, index) => {
        const weekFirstDay = addDate(firstDay, index * 7);
        return <Week date={weekFirstDay} row={index + 2} />;
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        console.log("day", day);
        return <DayHeader date={day} index={index} dateFormatter={dateFormatter} />
    });

    return <div className={styles.root}>
        {dayTitles}
        {weeks}
    </div>
}
