import { createContext, useMemo } from "react";
import styles from "./Sync.module.scss";
import { useDeviceType, useStyles } from "@util/styles";
import { useSyncFeature } from "@util/sync";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import SyncIcon from '@material-ui/icons/Sync';
import SyncProblemIcon from '@material-ui/icons/SyncProblem';
import { formatDuration } from "@util/string";

registerToolbar("Sync");

export const SyncContext = createContext();

export default function Sync({ children }) {
    const isDesktop = useDeviceType() === "desktop";
    const translations = useTranslations();
    const [updateSync, fullSync, isBusy, error, active, duration] = useSyncFeature();
    const className = useStyles(styles, {
        animated: isBusy
    });

    const formattedDuration = formatDuration(duration);
    const name = <span>
        {isBusy ? translations.SYNCING : translations.SYNC}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const toolbarItems = [
        active && updateSync && {
            id: "sync",
            name,
            location: "header",
            menu: false,
            icon: error ? <SyncProblemIcon /> : <SyncIcon className={className} />,
            onClick: updateSync,
            divider: isDesktop
        },
        active && fullSync && {
            id: "fullSync",
            name: translations.FULL_SYNC,
            icon: <SyncIcon />,
            onClick: fullSync,
            label: true,
            location: "advanced"
        }
    ].filter(Boolean);

    useToolbar({ id: "Sync", items: toolbarItems, depends: [isBusy, translations, updateSync, fullSync, active, duration, isDesktop] });

    const syncContext = useMemo(() => {
        return { updateSync, fullSync, error };
    }, [updateSync, fullSync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
