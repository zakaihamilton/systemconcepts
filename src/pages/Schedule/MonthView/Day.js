import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth } from "@/util/date";
import Avatar from '@material-ui/core/Avatar';

export default function Day({ month, column, row, date, dateFormatter }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    return <div className={styles.root} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)}>
                {dayNumber}
            </Avatar>
        </div>
    </div>
}