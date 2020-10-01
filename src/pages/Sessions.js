import { useSessions } from "@/util/sessions";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { useTranslations } from "@/util/translations";
import UpdateIcon from "@material-ui/icons/Update";
import styles from "./Sessions.module.scss";
import { useOnline } from "@/util/online";
import { formatDuration } from "@/util/string";
import Cookies from 'js-cookie';
import { useStyles } from "@/util/styles";

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

    return null;
}
