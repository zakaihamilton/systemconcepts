import styles from "./SessionGroup.module.scss";
import Session from "./Session";
import { useSessionTextColor } from "@util/colors";

export default function SessionGroup({ group, sessions }) {
    const groupLabel = group[0].toUpperCase() + group.slice(1);
    const firstSession = sessions[0];
    const groupColor = firstSession.color;

    const textColor = useSessionTextColor(groupColor);

    return <div className={styles.root}>
        <div className={styles.title} style={{ color: textColor }}>
            <div className={styles.background} style={{ backgroundColor: groupColor }} />
            <span style={{ position: "relative" }}>{groupLabel}</span>
        </div>
        <div className={styles.items}>
            {sessions
                .sort((a, b) => (a.typeOrder || 0) - (b.typeOrder || 0))
                .map(session => {
                    const { name, key, ...props } = session;
                    return <Session key={name} name={name} {...props} />;
                })}
        </div>
    </div>;
}
