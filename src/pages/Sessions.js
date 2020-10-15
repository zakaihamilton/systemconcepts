import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { addPath } from "@/util/pages";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import SyncMessage from "@/widgets/Table/SyncMessage";
import { Store } from "pullstate";
import Group from "@/widgets/Group";
import styles from "./Sessions.module.scss";

export const SessionsStore = new Store({
    groupFilter: "",
    dateFilter: "",
    order: "asc",
    orderBy: "date",
    viewMode: "list"
});

export default function SessionsPage() {
    const translations = useTranslations();
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter, busy], !busy);
    const { viewMode, groupFilter, dateFilter } = SessionsStore.useState();

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true,
            ellipsis: true,
            onSelectable: () => true,
            onClick: item => {
                addPath(`session?prefix=sessions&group=${item.group}&year=${item.year}&date=${item.date}&name=${item.name}&color=${item.color}`);
            }
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true,
            selected: () => dateFilter,
            onSelectable: item => typeof item.date !== "undefined",
            tags: [dateFilter && {
                id: dateFilter,
                name: dateFilter,
                onDelete: () => SessionsStore.update(s => {
                    s.dateFilter = "";
                    s.offset = 0;
                })
            }],
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
            tags: [groupFilter && {
                id: groupFilter,
                name: groupFilter,
                onDelete: () => SessionsStore.update(s => { s.groupFilter = "" })
            }],
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
        return {
            ...item,
            group: item.group,
            groupWidget: <Group name={item.group} color={item.color} />
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
            name="sessions"
            store={SessionsStore}
            columns={columns}
            data={sessions}
            loading={busy}
            mapper={mapper}
            filter={filter}
            viewModeToggle={true}
            itemProps={{
                className: styles.item
            }}
            loadingElement={<SyncMessage />}
            depends={[groupFilter, dateFilter, translations]}
        />
    </>;
}
