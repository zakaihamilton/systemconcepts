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
    const { sync, busy, error, duration, changed, percentage, phase } = useSyncFeature();
    const { busy: sessionsBusy } = UpdateSessionsStore.useState();
    const { personalSyncBusy, personalSyncError } = SyncActiveStore.useState();
    const isBusy = busy || sessionsBusy || personalSyncBusy;
    const className = useStyles(styles, {
        animated: isBusy
    });

    const formattedDuration = formatDuration(duration);
    const showPercentage = isBusy && (busy || personalSyncBusy);

    const getSyncLabel = () => {
        if (phase === "main") return translations.SYNCING_MAIN;
        if (phase === "library") return translations.SYNCING_LIBRARY;
        if (phase === "personal" || personalSyncBusy) return translations.SYNCING_PERSONAL;
        return translations.SYNCING;
    };

    const name = <span>
        {!!error && translations.SYNC_FAILED}
        {!!personalSyncError && translations.PERSONAL_SYNC_ERROR}
        {!error && !personalSyncError && (isBusy ? getSyncLabel() : translations.SYNC)}
        {showPercentage && ` (${percentage}%)`}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const ariaLabel = (() => {
        if (error) return translations.SYNC_FAILED;
        if (personalSyncError) return translations.PERSONAL_SYNC_ERROR;
        if (isBusy) {
            return `${getSyncLabel()}${showPercentage ? ` (${percentage}%)` : ''}`;
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
        }
    ].filter(Boolean);

    useToolbar({ id: "Sync", items: toolbarItems, depends: [busy, translations, sync, changed, duration, error, percentage, sessionsBusy, personalSyncBusy, personalSyncError, showPercentage, ariaLabel] });

    const syncContext = useMemo(() => {
        return { updateSync: sync, error };
    }, [sync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
