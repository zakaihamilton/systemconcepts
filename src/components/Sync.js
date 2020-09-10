import styles from "./Sync.module.scss";
import { useStyles } from "@/util/styles";
import { useSyncFeature } from "@/util/sync";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import SyncIcon from '@material-ui/icons/Sync';
import SyncProblemIcon from '@material-ui/icons/SyncProblem';

registerToolbar("Sync");

export default function Sync() {
    const translations = useTranslations();
    const [updateSync, isBusy, error] = useSyncFeature();
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
        {
            id: "sync",
            name,
            icon: error ? <SyncProblemIcon /> : <SyncIcon className={className} />,
            onClick: updateSync,
            divider: true
        }
    ];

    useToolbar({ id: "Sync", items: menuItems, depends: [isBusy] });
    return null;
}
