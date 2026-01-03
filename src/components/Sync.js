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
    const { sync, busy, error, duration, changed, percentage, currentBundle } = useSyncFeature();
    const { busy: sessionsBusy } = UpdateSessionsStore.useState();
    const { personalSyncBusy, personalSyncError } = SyncActiveStore.useState();
    const isBusy = busy || sessionsBusy || personalSyncBusy;
    const className = useStyles(styles, {
        animated: isBusy
    });

    const formattedDuration = formatDuration(duration);

    const name = <span>
        {!!error && translations.SYNC_FAILED}
        {!!personalSyncError && translations.PERSONAL_SYNC_ERROR}
        {!error && !personalSyncError && (isBusy ? translations.SYNCING : translations.SYNC)}
        {personalSyncBusy && translations.PERSONAL_SYNC_BUSY}
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

    useToolbar({ id: "Sync", items: toolbarItems, depends: [busy, translations, sync, changed, duration, error, percentage, currentBundle, sessionsBusy, personalSyncBusy, personalSyncError] });

    const syncContext = useMemo(() => {
        return { updateSync: sync, error };
    }, [sync, error]);

    return <SyncContext.Provider value={syncContext}>
        {children}
    </SyncContext.Provider>;
}
