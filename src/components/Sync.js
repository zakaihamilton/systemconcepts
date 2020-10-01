import styles from "./Sync.module.scss";
import { useDeviceType, useStyles } from "@/util/styles";
import { useSyncFeature } from "@/util/sync";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import SyncIcon from '@material-ui/icons/Sync';
import SyncProblemIcon from '@material-ui/icons/SyncProblem';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import { formatDuration } from "@/util/string";

registerToolbar("Sync");

export default function Sync() {
    const isDesktop = useDeviceType() === "desktop";
    const translations = useTranslations();
    const [updateSync, resetSync, isBusy, error, active, duration] = useSyncFeature();
    const className = useStyles(styles, {
        animated: isBusy
    });

    const formattedDuration = formatDuration(duration);
    const name = <span>
        {isBusy ? translations.SYNCING : translations.SYNC}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const menuItems = [
        active && updateSync && {
            id: "sync",
            name,
            icon: error ? <SyncProblemIcon /> : <SyncIcon className={className} />,
            onClick: updateSync,
            divider: isDesktop
        },
        active && resetSync && {
            id: "resetSync",
            name: translations.RESET_SYNC,
            icon: <HighlightOffIcon />,
            onClick: resetSync,
            menu: true
        }
    ].filter(Boolean);

    useToolbar({ id: "Sync", items: menuItems, depends: [isBusy, translations, updateSync, resetSync, active, duration, isDesktop] });
    return null;
}
