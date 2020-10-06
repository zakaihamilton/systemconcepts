import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday } from "@/util/date";
import Avatar from '@material-ui/core/Avatar';

export default function Day({ column, row, date, dateFormatter }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    return <div className={styles.root} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today)}>
                {dayNumber}
            </Avatar>
        </div>
    </div>
}