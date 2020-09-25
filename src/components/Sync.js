import styles from "./Sync.module.scss";
import { useStyles } from "@/util/styles";
import { useSyncFeature } from "@/util/sync";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import SyncIcon from '@material-ui/icons/Sync';
import SyncProblemIcon from '@material-ui/icons/SyncProblem';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';

registerToolbar("Sync");

export default function Sync() {
    const translations = useTranslations();
    const [updateSync, resetSync, isBusy, error, active] = useSyncFeature();
    const className = useStyles(styles, {
        animated: isBusy
    });

    let name = translations.SYNC;
    if (isBusy) {
        name = translations.SYNCING;
    }
    else if (error) {
        name = translations.SYNC_FAILED;
    }

    const menuItems = [
        active && updateSync && {
            id: "sync",
            name,
            icon: error ? <SyncProblemIcon /> : <SyncIcon className={className} />,
            onClick: updateSync,
            divider: true
        },
        active && resetSync && {
            id: "resetSync",
            name: translations.RESET_SYNC,
            icon: <HighlightOffIcon />,
            onClick: resetSync,
            menu: true,
            divider: true
        }
    ];

    useToolbar({ id: "Sync", items: menuItems, depends: [isBusy, updateSync, resetSync, active] });
    return null;
}
