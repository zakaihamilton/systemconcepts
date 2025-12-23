import { createContext, useMemo } from "react";
import styles from "./Sync.module.scss";
import { useDeviceType, useStyles } from "@util/styles";
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
    const isDesktop = useDeviceType() === "desktop";
    const translations = useTranslations();
    const { sync, fullSync, busy, error, active, duration, changed } = useSyncFeature();
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
        active && sync && {
            id: "sync",
            name,
            location: "header",
            menu: !isDesktop,
            icon: syncIcon,
            onClick: sync,
            divider: isDesktop
        },
        active && fullSync && {
            id: "fullSync",
            name: translations.FULL_SYNC,
            icon: <SyncIcon />,
            onClick: fullSync,
            location: "header",
            menu: "true"
        }
    ].filter(Boolean);

    useToolbar({ id: "Sync", items: toolbarItems, depends: [busy, translations, sync, fullSync, changed, active, duration, error, isDesktop] });

    const syncContext = useMemo(() => {
        return { updateSync: sync, fullSync, error };
    }, [sync, fullSync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
