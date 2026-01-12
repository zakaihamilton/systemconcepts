import { createContext, useMemo } from "react";
import { setPath } from "@util/pages";
import styles from "./Sync.module.scss";
import { useStyles } from "@util/styles";
import { useSyncFeature } from "@sync/sync";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import SyncIcon from "@mui/icons-material/Sync";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import { formatDuration } from "@util/string";
import Badge from "@mui/material/Badge";

registerToolbar("Sync", 1);

export const SyncContext = createContext();

import { UpdateSessionsStore, SyncActiveStore } from "@sync/syncState";

export default function Sync({ children }) {
    const translations = useTranslations();
    const { sync, busy, error, duration, changed, percentage, currentBundle, personalSyncPercentage } = useSyncFeature();
    const { busy: sessionsBusy } = UpdateSessionsStore.useState();
    const { personalSyncBusy, personalSyncError } = SyncActiveStore.useState();
    const isBusy = busy || sessionsBusy || personalSyncBusy;
    const className = useStyles(styles, {
        animated: isBusy
    });

    const formattedDuration = formatDuration(duration);
    const activePercentage = (personalSyncBusy ? personalSyncPercentage : percentage) ?? 0;
    const showPercentage = isBusy && (busy || personalSyncBusy);

    const name = <span>
        {!!error && translations.SYNC_FAILED}
        {!!personalSyncError && translations.PERSONAL_SYNC_ERROR}
        {!error && !personalSyncError && (personalSyncBusy ? (translations.PERSONAL + " " + translations.SYNCING) : (isBusy ? translations.SYNCING : translations.SYNC))}
        {showPercentage && ` (${activePercentage}%)`}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const ariaLabel = (() => {
        if (error) return translations.SYNC_FAILED;
        if (personalSyncError) return translations.PERSONAL_SYNC_ERROR;
        if (isBusy) {
            const label = personalSyncBusy ? (translations.PERSONAL + " " + translations.SYNCING) : translations.SYNCING;
            return `${label}${showPercentage ? ` (${activePercentage}%)` : ''}`;
        }
        return translations.SYNC;
    })();

    const syncIcon =
        <Badge overlap="rectangular" color="secondary" variant="dot" invisible={!changed}>
            {error ? <SyncProblemIcon /> : <SyncIcon className={className} />}
        </Badge>;

    const toolbarItems = [
        {
            id: "sync",
            name,
            ariaLabel,
            location: "header",
            sortKey: 1,
            menu: false,
            icon: syncIcon,
            onClick: () => {
                if (busy) {
                    setPath("sync");
                }
                else if (sessionsBusy) {
                    UpdateSessionsStore.update(s => {
                        s.showUpdateDialog = true;
                    });
                } else {
                    sync();
                }
            }
        },

    ].filter(Boolean);

    useToolbar({ id: "Sync", items: toolbarItems, depends: [busy, translations, sync, changed, duration, error, percentage, currentBundle, sessionsBusy, personalSyncBusy, personalSyncError, activePercentage, showPercentage, ariaLabel] });

    const syncContext = useMemo(() => {
        return { updateSync: sync, error };
    }, [sync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
