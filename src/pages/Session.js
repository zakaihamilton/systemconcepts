import { useTranslations } from "@util/translations";
import { useSessions } from "@util/sessions";
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration } from "@util/string";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import styles from "./Session.module.scss";

export const SessionStore = new Store({
    viewMode: "list"
});

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [sessions, loading] = useSessions([], false);
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

    const columns = [
        {
            id: "name",
            sortable: "idx",
            title: translations.NAME
        },
        {
            id: "widget",
            title: translations.VALUE
        }
    ];

    const data = [
        {
            name: translations.NAME,
            value: name,
            widget: name
        },
        {
            name: translations.GROUP,
            value: group,
            widget: <Group name={group} color={session && session.color} />
        },
        {
            name: translations.DATE,
            value: date,
            widget: date && dateFormatter.format(new Date(date))
        },
        {
            name: translations.DURATION,
            value: session && session.duration,
            widget: session && session.duration ? formatDuration(session.duration * 1000, true) : translations.UNKNOWN
        }
    ];

    const mapper = (item, idx) => {
        return { ...item, idx };
    };

    const onExport = () => {
        return JSON.stringify(session, null, 4);
    };

    return <Table
        name={session && session.id || "session"}
        data={data}
        loading={loading}
        columns={columns}
        mapper={mapper}
        showSort={false}
        onExport={onExport}
        viewModes={{
            list: {
                className: styles.listItem
            }
        }}
        store={SessionStore}
    />;
}
