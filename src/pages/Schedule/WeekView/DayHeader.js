import clsx from "clsx";
import styles from "./DayHeader.module.scss";
import { useDeviceType } from "@util/styles";
import { isDateToday } from "@util/date";

export default function DayHeader({ dateFormatter, dayFormatter, date, index }) {
    const isPhone = useDeviceType() === "phone";
    const style = {
        gridColumn: isPhone ? 1 : index + 1,
        gridRow: isPhone ? index + 1 : 1
    }
    const dayName = dayFormatter.format(date);
    const dateName = dateFormatter.format(date);
    const isToday = isDateToday(date);
    return <div className={clsx(styles.root, isToday && styles.today, isPhone && styles.mobile)} style={style}>
        <div className={styles.day}>{dayName}</div>
        <div>{dateName}</div>
    </div>
}
