import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";
import { Store } from "pullstate";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";

export const ScheduleStore = new Store({
    date: null
});

export default function SchedulePage() {
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter], !busy);
    let { date } = ScheduleStore.useState();
    if (!date) {
        date = new Date();
    }
    return <div className={styles.root}>
        <MonthView sessions={sessions} date={date} store={ScheduleStore} />
    </div>;
}
