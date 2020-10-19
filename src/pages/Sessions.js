import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { addPath } from "@/util/pages";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import { Store } from "pullstate";
import Group from "@/widgets/Group";
import styles from "./Sessions.module.scss";
import Label from "@/widgets/Label";
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@/icons/Audio";
import Tooltip from '@material-ui/core/Tooltip';
import Image from "@/widgets/Image";
import GraphicEqIcon from '@material-ui/icons/GraphicEq';
import clsx from "clsx";
import { useLocalStorage } from "@/util/store";

export const SessionsStore = new Store({
    groupFilter: "",
    dateFilter: "",
    order: "asc",
    orderBy: "date",
    viewMode: "list"
});

export default function SessionsPage() {
    const translations = useTranslations();
    const [syncCounter, syncing] = useSync();
    const [sessions, loading] = useSessions([syncCounter, syncing], !syncing);
    const { viewMode, groupFilter, dateFilter } = SessionsStore.useState();
    useLocalStorage("SessionsStore", SessionsStore);
    const gotoItem = item => {
        addPath(`session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${item.name}&color=${item.color}`);
    };

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            onSelectable: () => true,
            onClick: gotoItem,
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridName
                }
            }
        },
        {
            id: "thumbnailWidget",
            onSelectable: () => true,
            title: translations.THUMBNAIL,
            onClick: gotoItem,
            viewModes: {
                "grid": {
                    className: styles.gridThumbnail
                }
            }
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true,
            selected: () => dateFilter,
            onSelectable: item => typeof item.date !== "undefined",
            onClick: item => SessionsStore.update(s => {
                if (s.dateFilter) {
                    s.dateFilter = "";
                }
                else {
                    s.dateFilter = typeof item.date !== "undefined" && item.date;
                }
                s.offset = 0;
            }),
            style: {
                justifyContent: "center"
            }
        },
        {
            id: "groupWidget",
            title: translations.GROUP,
            sortable: "group",
            selected: () => groupFilter,
            onSelectable: item => typeof item.group !== "undefined",
            onClick: item => SessionsStore.update(s => {
                if (s.groupFilter) {
                    s.groupFilter = "";
                }
                else {
                    s.groupFilter = typeof item.group !== "undefined" && (item.group[0].toUpperCase() + item.group.slice(1));
                }
                s.offset = 0;
            }),
            style: {
                justifyContent: "center"
            }
        }
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        const icon = item.video ? <MovieIcon /> : <AudioIcon />;
        const altIcon = item.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />;
        return {
            ...item,
            nameWidget: <Label className={styles.labelName} icon={icon} name={
                <Tooltip arrow title={item.name}>
                    <div className={clsx(styles.labelText, viewMode !== "table" && styles.singleLine)}>
                        {item.name}
                    </div>
                </Tooltip>
            } />,
            group: item.group,
            groupWidget: <Group name={item.group} color={item.color} />,
            thumbnailWidget: <Image clickForImage={false} path={item.thumbnail} width="13em" height="9em" alt={altIcon} />
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
            itemHeight="4em"
            cellWidth="16em"
            cellHeight="14em"
            name="sessions"
            store={SessionsStore}
            columns={columns}
            data={sessions}
            syncing={syncing}
            loading={loading}
            mapper={mapper}
            filter={filter}
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null,
                grid: {
                    className: styles.gridItem
                }
            }}
            depends={[groupFilter, dateFilter, translations, viewMode]}
        />
    </>;
}
