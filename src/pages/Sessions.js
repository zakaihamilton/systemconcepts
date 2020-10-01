import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useSessions } from "@/util/sessions";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import UpdateIcon from "@material-ui/icons/Update";
import styles from "./UpdateSessions.module.scss";
import { useOnline } from "@/util/online";
import Cookies from 'js-cookie';
import { useStyles } from "@/util/styles";
import { formatDuration } from "@/util/string";
import MovieIcon from '@material-ui/icons/Movie';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import { IconButton } from "@material-ui/core";
import Tooltip from "@material-ui/core/Tooltip";
import { addPath } from "@/util/pages";

registerToolbar("Sessions");

export default function Sessions() {
    const translations = useTranslations();
    const online = useOnline();
    const [sessions, busy, start, updateSessions] = useSessions();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;

    const duration = start && new Date().getTime() - start;
    const formattedDuration = formatDuration(duration);
    const name = <span>
        {busy ? translations.SYNCING : translations.SYNC}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const className = useStyles(styles, {
        animated: busy
    });

    const menuItems = [
        syncEnabled && {
            id: "sessions",
            name,
            icon: <UpdateIcon className={className} />,
            onClick: () => updateSessions && updateSessions()
        }
    ].filter(Boolean);

    useToolbar({ id: "Sessions", items: menuItems, depends: [syncEnabled, busy, translations, parseInt(duration / 1000)] });

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "mediaWidget",
            title: translations.MEDIA,
            sortable: "media"
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true
        },
        {
            id: "group",
            title: translations.GROUP,
            sortable: true
        }
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        const media = [];
        if (item.audio) {
            media.push({
                name: translations.AUDIO,
                icon: <AudiotrackIcon />,
                link: `audio?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.audio.name}`
            });
        }
        if (item.video) {
            media.push({
                name: translations.VIDEO,
                icon: <MovieIcon />,
                link: `video?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.video.name}`
            });
        }
        return {
            ...item,
            group: item.group[0].toUpperCase() + item.group.slice(1),
            media: media.map(element => element.id).join(" "),
            mediaWidget: (<div className={styles.mediaLinks}>
                {media.map(element => {
                    const gotoLink = () => {
                        addPath(element.link);
                    };
                    return <IconButton key={element.name} onClick={gotoLink}>
                        <Tooltip arrow title={element.name}>
                            {element.icon}
                        </Tooltip>
                    </IconButton>
                })}
            </div>)
        };
    };

    return <>
        <Table
            rowHeight="5.5em"
            name="sessions"
            sortColumn="date"
            sortDirection="asc"
            columns={columns}
            data={sessions}
            mapper={mapper}
            depends={[translations]}
        />
    </>;
}
