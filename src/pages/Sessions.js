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
        return {
            ...item,
            group: item.group[0].toUpperCase() + item.group.slice(1)
        }
    };

    return <>
        <Table rowHeight="5.5em" name="sessions" sortColumn="date" sortDirection="asc" columns={columns} data={sessions} mapper={mapper} />
    </>;
}
