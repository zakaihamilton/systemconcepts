import clsx from "clsx";
import styles from "./DayHeader.module.scss";
import { useDeviceType } from "@util/styles";
import { isDateToday } from "@util/date";

export default function DayHeader({ dateFormatter, dayFormatter, date, index, count }) {
    const isPhone = useDeviceType() === "phone";
    const style = {
        gridColumn: isPhone ? 1 : index + 1,
        gridRow: isPhone ? index + 1 : 1
    };
    const dayName = dayFormatter.format(date);
    const dateName = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const className = clsx(
        styles.root,
        isToday && styles.today,
        isPhone && styles.mobile,
        index === count - 1 && styles.last
    );
    return <div className={className} style={style}>
        <div className={styles.day}>{dayName}</div>
        <div className={styles.date}>{dateName}</div>
    </div>;
}
