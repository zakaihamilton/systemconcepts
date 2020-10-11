import { useTranslations } from "@/util/translations";
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./Session.module.scss";
import Image from "./Session/Image";
import { useFetchJSON } from "@/util/fetch";
import { makePath } from "@/util/path";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import GraphicEqIcon from '@material-ui/icons/GraphicEq';
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@/icons/Audio";
import { addPath } from "@/util/pages";
import { registerToolbar, useToolbar } from "@/components/Toolbar";

registerToolbar("Session");

export default function SessionPage({ prefix, group, year, date, name }) {
    const translations = useTranslations();
    let components = [prefix, group, year, date + " " + name + ".png"].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter], !busy, false);
    const session = sessions && sessions.find(session =>
        session.group === group &&
        session.name === name &&
        session.date === date &&
        session.year === year);

    const metadataSet = (name, value) => {
        return (<div className={styles.set}>
            <div className={styles.name}>
                {translations[name]}:
        </div>
            <div className={styles.value}>
                <Tooltip arrow title={value}>
                    <div className={styles.text}>{value}</div>
                </Tooltip>
            </div>
        </div>);
    };

    const gotoPlayer = (suffix) => {
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

    return <div className={styles.root}>
        <div className={styles.info}>
            <div className={styles.preview}>
                {session && session.video && <Image path={data && data.path} width="9em" height="9em" alt={<MovieIcon fontSize="large" />} />}
                {session && !session.video && <GraphicEqIcon fontSize="large" />}
            </div>
            <div className={styles.metadata}>
                {metadataSet("NAME", name)}
                {metadataSet("GROUP", group[0].toUpperCase() + group.slice(1))}
                {metadataSet("DATE", date)}
            </div>
        </div>
    </div>;
}
