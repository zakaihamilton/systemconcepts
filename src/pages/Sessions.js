import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useSessions } from "@/util/sessions";
import styles from "./Sessions.module.scss";
import MovieIcon from '@material-ui/icons/Movie';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import { IconButton } from "@material-ui/core";
import Tooltip from "@material-ui/core/Tooltip";
import { addPath } from "@/util/pages";
import { useState } from "react";
import { useSync } from "@/util/sync";
import SyncMessage from "@/widgets/Table/SyncMessage";

export default function Sessions() {
    const translations = useTranslations();
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter], !busy);
    const [groupFilter, setGroupFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");

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
            sortable: true,
            onSelectable: item => typeof item.date !== "undefined" && !dateFilter,
            tags: [dateFilter && {
                id: dateFilter,
                name: dateFilter,
                onDelete: () => setDateFilter("")
            }],
            onClick: !dateFilter && (item => setDateFilter(typeof item.date !== "undefined" && item.date))
        },
        {
            id: "group",
            title: translations.GROUP,
            sortable: true,
            onSelectable: item => typeof item.group !== "undefined" && !groupFilter,
            tags: [groupFilter && {
                id: groupFilter,
                name: groupFilter,
                onDelete: () => setGroupFilter("")
            }],
            onClick: !groupFilter && (item => setGroupFilter(typeof item.group !== "undefined" && item.group))
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
                link: `player?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.date + " " + item.name}&suffix=.m4a`
            });
        }
        if (item.video) {
            media.push({
                name: translations.VIDEO,
                icon: <MovieIcon />,
                link: `player?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.date + " " + item.name}&suffix=.mp4`
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
                    return <div key={element.name} className={styles.mediaLink}>
                        <IconButton onClick={gotoLink}>
                            <Tooltip arrow title={element.name}>
                                {element.icon}
                            </Tooltip>
                        </IconButton>
                    </div>
                })}
            </div>)
        };
    };

    const filter = item => {
        let { date, group } = item;
        let show = !dateFilter || dateFilter === date;
        show = show && (!groupFilter || groupFilter === (group[0].toUpperCase() + group.slice(1)));
        return show;
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
            filter={filter}
            empty={<SyncMessage show={busy} />}
            reset={[groupFilter, dateFilter]}
            depends={[groupFilter, dateFilter, translations]}
        />
    </>;
}
