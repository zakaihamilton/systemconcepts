import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@/icons/Audio";
import Tooltip from "@material-ui/core/Tooltip";
import { addPath } from "@/util/pages";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import SyncMessage from "@/widgets/Table/SyncMessage";
import { Store } from "pullstate";
import Label from "@/widgets/Label";
import Menu from "@/widgets/Menu";
import VideoLabelIcon from '@material-ui/icons/VideoLabel';

export const SessionsStore = new Store({
    groupFilter: "",
    dateFilter: "",
    order: "asc",
    orderBy: "date"
});

export default function SessionsPage() {
    const translations = useTranslations();
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter], !busy);
    const { groupFilter, dateFilter } = SessionsStore.useState();

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true,
            onSelectable: () => true,
            onClick: item => {
                addPath(`session?prefix=sessions&group=${item.group}&year=${item.year}&date=${item.date}&name=${item.name}`);
            }
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true,
            onSelectable: item => typeof item.date !== "undefined" && !dateFilter,
            tags: [dateFilter && {
                id: dateFilter,
                name: dateFilter,
                onDelete: () => SessionsStore.update(s => {
                    s.dateFilter = "";
                    s.offset = 0;
                })
            }],
            onClick: !dateFilter && (item => SessionsStore.update(s => {
                s.dateFilter = typeof item.date !== "undefined" && item.date;
                s.offset = 0;
            }))
        },
        {
            id: "groupWidget",
            title: translations.GROUP,
            sortable: "group",
            onSelectable: item => typeof item.group !== "undefined" && !groupFilter,
            tags: [groupFilter && {
                id: groupFilter,
                name: groupFilter,
                onDelete: () => SessionsStore.update(s => { s.groupFilter = "" })
            }],
            onClick: !groupFilter && (item => SessionsStore.update(s => {
                s.groupFilter = typeof item.group !== "undefined" && (item.group[0].toUpperCase() + item.group.slice(1));
                s.offset = 0;
            }))
        }
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        return {
            ...item,
            group: item.group,
            groupWidget: item.group[0].toUpperCase() + item.group.slice(1)
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
            store={SessionsStore}
            columns={columns}
            data={sessions}
            mapper={mapper}
            filter={filter}
            empty={<SyncMessage show={busy} />}
            depends={[groupFilter, dateFilter, translations]}
        />
    </>;
}
