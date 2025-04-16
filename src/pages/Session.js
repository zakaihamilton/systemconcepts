import { useTranslations } from "@util/translations";
import { useSessions } from "@util/sessions";
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration } from "@util/string";
import Table from "@widgets/Table";
import { Store } from "pullstate";

export const SessionStore = new Store({
    viewMode: "table"
});

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [sessions, loading] = useSessions([], { filterSessions: false });
    const dateFormatter = useDateFormatter({
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
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

    let dateWidget = "";
    try {
        dateWidget = date && dateFormatter.format(new Date(date));
    }
    catch (err) {
        console.error("err", err, "group", group, "year", year, "date", date, "name", name);
    }

    const data = [
        {
            name: translations.NAME,
            value: name,
            widget: name
        },
        {
            name: translations.GROUP,
            value: group,
            widget: <Group name={group} fit={true} color={session && session.color} />
        },
        {
            name: translations.DATE,
            value: date,
            widget: dateWidget
        },
        {
            name: translations.DURATION,
            value: session && session.duration,
            widget: session && session.duration ? formatDuration(session.duration * 1000, true) : translations.UNKNOWN
        },
        {
            name: translations.FULL_NAME,
            value: date + " " + name,
            widget: date + " " + name
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
            table: null
        }}
        store={SessionStore}
    />;
}
