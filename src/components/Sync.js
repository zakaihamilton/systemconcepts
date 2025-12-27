import { createContext, useMemo } from "react";
import styles from "./Sync.module.scss";
import { useStyles } from "@util/styles";
import { useSyncFeature } from "@util/sync";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import SyncIcon from "@mui/icons-material/Sync";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import { formatDuration } from "@util/string";
import Badge from "@mui/material/Badge";

registerToolbar("Sync", 1);

export const SyncContext = createContext();

export default function Sync({ children }) {
    const translations = useTranslations();
    const { sync, busy, error, duration, changed, percentage, currentBundle } = useSyncFeature();
    const className = useStyles(styles, {
        animated: busy
    });

    const formattedDuration = formatDuration(duration);

    const name = <span>
        {!!error && translations.SYNC_FAILED}
        {!error && (busy ? translations.SYNCING : translations.SYNC)}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const syncIcon =
        <Badge overlap="rectangular" color="secondary" variant="dot" invisible={!changed}>
            {error ? <SyncProblemIcon /> : <SyncIcon className={className} />}
        </Badge>;

    const toolbarItems = [
        {
            id: "sync",
            name,
            location: "header",
            menu: false,
            icon: syncIcon,
            onClick: sync
        },

    ].filter(Boolean);

    useToolbar({ id: "Sync", items: toolbarItems, depends: [busy, translations, sync, changed, duration, error, percentage, currentBundle] });

    const syncContext = useMemo(() => {
        return { updateSync: sync, error };
    }, [sync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
