import styles from "./Day.module.scss";
import { useDeviceType } from "@util/styles";
import { getDateString } from "@util/date";
import Session from "./Session";
import clsx from "clsx";

export default function Day({ sessions, column, row, count, date }) {
    const isPhone = useDeviceType() === "phone";
    const style = {
        gridColumn: column,
        gridRow: row
    };
    const sessionDate = getDateString(date);
    const sessionItems = (sessions || [])
        .filter(session => session.date === sessionDate)
        .sort((a, b) => {
            const groupCompare = (a.group || "").localeCompare(b.group || "");
            if (groupCompare !== 0) return groupCompare;
            return (a.typeOrder || 0) - (b.typeOrder || 0);
        })
        .map(session => {
            const { name, key, ...sessionProps } = session;
            return <Session key={name} name={name} {...sessionProps} />;
        });
    return <div className={clsx(styles.root, column === count && styles.last, isPhone && styles.mobile)} style={style}>
        <div className={clsx(styles.sessions, isPhone && styles.mobile)}>
            {sessionItems}
        </div>
    </div>;
}