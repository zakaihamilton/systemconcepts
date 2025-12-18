import styles from "./Day.module.scss";
import { useDeviceType } from "@util/styles";
import { getDateString } from "@util/date";
import Session from "./Session";
import clsx from "clsx";

export default function Day({ sessions, column, row, count, date }) {
    const isPhone = useDeviceType() === "phone";
    const style = {
        gridColumn: isPhone ? row : column,
        gridRow: isPhone ? column : row
    };
    const sessionDate = getDateString(date);
    const sessionItems = (sessions || []).filter(session => session.date === sessionDate).map(session => {
        return <Session key={session.name} {...session} />;
    });
    return <div className={clsx(styles.root, column === count && styles.last)} style={style}>
        <div className={clsx(styles.sessions, isPhone && styles.mobile)}>
            {sessionItems}
        </div>
    </div>;
}