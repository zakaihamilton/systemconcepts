import clsx from "clsx";
import styles from "./DayHeader.module.scss";
import { isDayToday } from "@util/date";

export default function DayHeader({ dateFormatter, date, index, count }) {
    const style = {
        gridColumn: index + 1,
        gridRow: 1
    }
    const dayName = dateFormatter.format(date);
    const isToday = isDayToday(date);
    const className = clsx(
        styles.root,
        isToday && styles.today,
        index === count - 1 && styles.last
    );
    return <div className={className} style={style}>
        {dayName}
    </div>
}
