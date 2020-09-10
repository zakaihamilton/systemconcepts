import styles from "./Sync.module.scss";
import { useStyles } from "@/util/styles";
import { useSync } from "@/storage/sync";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import SyncIcon from '@material-ui/icons/Sync';

registerToolbar("Sync");

export default function Sync() {
    const translations = useTranslations();
    const [updateSync, isBusy] = useSync();
    const className = useStyles(styles, {
        animated: isBusy
    });

    const menuItems = [
        {
            id: "sync",
            name: translations.SYNC,
            icon: <SyncIcon className={className} />,
            onClick: updateSync,
            divider: true
        }
    ];

    useToolbar({ id: "Sync", items: menuItems, depends: [isBusy] });
    return null;
}
