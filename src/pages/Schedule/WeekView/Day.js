import styles from "./Day.module.scss";
import { getDateString } from "@/util/date";
import Session from "./Session";

export default function Day({ sessions, column, row, date }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const sessionDate = getDateString(date);
    const sessionItems = sessions.filter(session => session.date === sessionDate).map(session => {
        return <Session key={session.name} {...session} />
    });
    return <div className={styles.root} style={style}>
        <div className={styles.sessions}>
            {sessionItems}
        </div>
    </div>
}