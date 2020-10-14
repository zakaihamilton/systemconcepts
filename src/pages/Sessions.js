import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { addPath } from "@/util/pages";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import SyncMessage from "@/widgets/Table/SyncMessage";
import { Store } from "pullstate";
import styles from "./Sessions.module.scss";

export const SessionsStore = new Store({
    groupFilter: "",
    dateFilter: "",
    order: "asc",
    orderBy: "date"
});

export default function SessionsPage() {
    const translations = useTranslations();
    const [syncCounter, busy] = useSync();
    const sessions = useSessions([syncCounter, busy], !busy);
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
        const groupName = item.group[0].toUpperCase() + item.group.slice(1);
        const style = { backgroundColor: item.color };
        return {
            ...item,
            group: item.group,
            groupWidget: <div className={styles.groupContainer}>
                <div className={styles.background} style={style} />
                <div className={styles.group} dir="auto">
                    {groupName}
                </div>
                <div className={styles.backgroundBorder} style={style} />
            </div>
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
