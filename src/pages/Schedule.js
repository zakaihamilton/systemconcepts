import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";

export default function SchedulePage() {
    const date = new Date();
    return <div className={styles.root}>
        <MonthView date={date} />
    </div>;
}
