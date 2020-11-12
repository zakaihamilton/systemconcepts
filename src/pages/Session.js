import { useTranslations } from "@util/translations";
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./Session.module.scss";
import { useSessions } from "@util/sessions";
import GraphicEqIcon from '@material-ui/icons/GraphicEq';
import MovieIcon from '@material-ui/icons/Movie';
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration } from "@util/string";

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [sessions] = useSessions([], false);
    const dateFormatter = useDateFormatter({
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const session = sessions && sessions.find(session =>
        session.group === group &&
        session.name === name &&
        session.date === date &&
        session.year === year);

    const metadataSet = (name, value, tooltip) => {
        return (<div className={styles.set}>
            <div className={styles.name}>
                {translations[name]}:
        </div>
            <div className={styles.value}>
                <Tooltip arrow title={tooltip || value}>
                    <div className={styles.text} dir="auto">{value}</div>
                </Tooltip>
            </div>
        </div>);
    };

    const altIcon = session ? (session.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />) : null;

    return <div className={styles.root}>
        <div className={styles.info}>
            <div className={styles.metadata}>
                {metadataSet("NAME", name)}
                {metadataSet("GROUP", <Group name={group} color={session && session.color} />, group && group[0].toUpperCase() + group.slice(1))}
                {metadataSet("DATE", date && dateFormatter.format(new Date(date)), date)}
                {metadataSet("DURATION", session && session.duration ? formatDuration(session.duration * 1000, true) : translations.UNKNOWN)}
            </div>
        </div>
    </div>;
}
