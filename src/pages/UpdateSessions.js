import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useUpdateSessions } from "@/util/updateSessions";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import UpdateIcon from "@material-ui/icons/Update";
import styles from "./UpdateSessions.module.scss";
import { useOnline } from "@/util/online";
import Cookies from 'js-cookie';
import { useStyles } from "@/util/styles";
import { formatDuration } from "@/util/string";
import Progress from "@/widgets/Progress";
import { Store } from "pullstate";

registerToolbar("UpdateSessions");

export const UpdateSessionsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: ""
});

export default function UpdateSessions({ }) {
    const translations = useTranslations();
    const online = useOnline();
    const [data, busy, start, updateSessions] = useUpdateSessions();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;

    const className = useStyles(styles, {
        animated: busy
    });

    const duration = start && new Date().getTime() - start;
    const formattedDuration = formatDuration(duration);
    const name = <span>
        {busy ? translations.SYNCING : translations.SYNC}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const menuItems = [
        syncEnabled && {
            id: "sessions",
            name,
            icon: <UpdateIcon className={className} />,
            onClick: updateSessions
        }
    ];

    useToolbar({ id: "UpdateSessions", items: menuItems, depends: [syncEnabled, busy, translations, parseInt(duration / 1000)] });

    const columns = [
        {
            id: "name",
            title: translations.FOLDER,
            sortable: true
        },
        {
            id: "progress",
            title: translations.PROGRESS
        },
        {
            id: "errorCount",
            title: translations.ERRORS
        }
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        const name = item.name[0].toUpperCase() + item.name.substring(1);
        const variant = item.progress !== -1 ? "static" : undefined;
        const tooltip = item.index + " / " + item.count;
        return {
            ...item,
            name,
            progress: !!item.progress && <Progress variant={variant} tooltip={tooltip} size={48} style={{ flex: 0, justifyContent: "initial" }} value={variant === "static" ? item.progress : undefined} />,
            errorCount: item.errors && item.errors.length > 0 && item.errors.length
        }
    };

    return <>
        <Table
            name="sessions"
            columns={columns}
            data={data}
            mapper={mapper}
            store={UpdateSessionsStore}
        />
    </>;
}
