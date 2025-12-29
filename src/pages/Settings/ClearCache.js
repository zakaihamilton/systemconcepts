import { useContext } from "react";
import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@widgets/Dialog";
import { goBackPage } from "@util/pages";
import storage from "@util/storage";
import { UpdateSessionsStore } from "@util/updateSessions";
import { SyncContext } from "@components/Sync";
import { clearBundleCache } from "@util/sync";

export default function ClearCache() {
    const translations = useTranslations();
    const { updateSync } = useContext(SyncContext);

    const reset = async () => {
        try {
            await clearBundleCache();
            await storage.deleteFolder("local/shared/sessions");
            if (await storage.exists("local/shared/sessions")) {
                console.error("Failed to delete local shared sessions folder");
                return;
            }
            UpdateSessionsStore.update(s => {
                s.busy = false; // Reset busy state to allow re-fetching
                s.status = [];
            });
            await updateSync(false); // Force full sync (not poll)
            goBackPage();
        } catch (err) {
            console.error("Failed to reset sessions", err);
        }
    };

    const cancel = () => {
        goBackPage();
    };

    const actions = (<>
        <Button variant="contained" color="error" onClick={reset}>
            {translations.CLEAR_CACHE}
        </Button>
        <Button variant="contained" onClick={cancel}>
            {translations.CANCEL}
        </Button>
    </>);

    return <Dialog title={translations.CLEAR_CACHE} onClose={cancel} actions={actions}>
        <Typography variant="body1">
            {translations.CLEAR_CACHE_MESSAGE}
        </Typography>
    </Dialog>;
}
