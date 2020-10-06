import clsx from "clsx";
import styles from "./DayHeader.module.scss";
import { isDateToday } from "@/util/date";

export default function DayHeader({ dateFormatter, date, index }) {
    const style = {
        gridColumn: index + 1,
        gridRow: 1
    }
    const dayName = dateFormatter.format(date);
    const isToday = isDateToday(date);
    return <div className={clsx(styles.root, isToday && styles.today)} style={style}>
        {dayName}
    </div>
}
