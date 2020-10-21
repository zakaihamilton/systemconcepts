import { useTranslations } from "@/util/translations";
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./Session.module.scss";
import Image from "@/widgets/Image";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import GraphicEqIcon from '@material-ui/icons/GraphicEq';
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@/icons/Audio";
import { addPath } from "@/util/pages";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { resetPlayer } from "@/pages/Player";
import { useDateFormatter } from "@/util/locale";
import Group from "@/widgets/Group";
import { formatDuration } from "@/util/string";

registerToolbar("Session");

export function getSessionSection({ date, name }) {
    return { label: date + " " + name };
}

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [syncCounter] = useSync();
    const [sessions] = useSessions([syncCounter], false);
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

    const gotoPlayer = (suffix) => {
        resetPlayer();
        addPath(`player?suffix=${suffix}`);
    }

    const items = [
        session && session.audio && {
            id: "audio",
            name: translations.AUDIO,
            icon: <AudioIcon />,
            location: "footer",
            divider: true,
            label: true,
            onClick: () => gotoPlayer(".m4a")
        },
        session && session.video && {
            id: "video",
            name: translations.VIDEO,
            icon: <MovieIcon />,
            location: "footer",
            divider: true,
            label: true,
            onClick: () => gotoPlayer(".mp4")
        }
    ].filter(Boolean);

    useToolbar({ id: "Session", items, depends: [translations, session] });

    const altIcon = session ? (session.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />) : null;

    return <div className={styles.root}>
        <div className={styles.info}>
            <div className={styles.preview}>
                <Image path={session && session.thumbnail} loading={!session} width="18em" height="18em" alt={altIcon} />
            </div>
            <div className={styles.metadata}>
                {metadataSet("NAME", name)}
                {metadataSet("GROUP", <Group name={group} color={session && session.color} />, group && group[0].toUpperCase() + group.slice(1))}
                {metadataSet("DATE", date && dateFormatter.format(new Date(date)), date)}
                {metadataSet("DURATION", session && session.duration ? formatDuration(session.duration * 1000, true) : translations.UNKNOWN)}
            </div>
        </div>
    </div>;
}
