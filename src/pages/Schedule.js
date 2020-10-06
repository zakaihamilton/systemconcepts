import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";
import { Store } from "pullstate";

export const ScheduleStore = new Store({
    date: null
});

export default function SchedulePage() {
    let { date } = ScheduleStore.useState();
    if (!date) {
        date = new Date();
    }
    return <div className={styles.root}>
        <MonthView date={date} store={ScheduleStore} />
    </div>;
}
