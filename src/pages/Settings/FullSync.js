import { useContext } from "react";
import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@widgets/Dialog";
import { goBackPage } from "@util/pages";
import { SyncContext } from "@components/Sync";
import { clearBundleCache } from "@sync/sync";
import { useNavigate } from "react-router-dom";

export default function FullSync() {
    const translations = useTranslations();
    const { updateSync } = useContext(SyncContext);
    const navigate = useNavigate();

    const reset = async () => {
        try {
            const success = await clearBundleCache();
            if (!success) {
                console.error("Failed to clear cache completely");
                // Still try to sync even if clear had issues
            }

            // Force a fresh sync after clearing
            await updateSync(false); // Force full sync (not poll)
            navigate("/sync");
        } catch (err) {
            console.error("Failed to reset cache and sync", err);
            // Still go back even on error so user isn't stuck
            goBackPage();
        }
    };

    const cancel = () => {
        goBackPage();
    };

    const actions = (<>
        <Button variant="contained" color="error" onClick={reset}>
            {translations.FULL_SYNC}
        </Button>
        <Button variant="contained" onClick={cancel}>
            {translations.CANCEL}
        </Button>
    </>);

    return <Dialog title={translations.FULL_SYNC} onClose={cancel} actions={actions}>
        <Typography variant="body1">
            {translations.FULL_SYNC_MESSAGE}
        </Typography>
    </Dialog>;
}
