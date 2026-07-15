import { SyncContext } from "@components/Sync";
import { clearBundleCache } from "@sync/sync";
import Button from "@ui/Button";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import { goBackPage, setPath } from "@util/domain/views";
import Dialog from "@widgets/Dialog";
import { useContext } from "react";

export default function FullSync() {
	const translations = useTranslations();
	const { updateSync } = useContext(SyncContext);

	const reset = async () => {
		try {
			const success = await clearBundleCache();
			if (!success) {
				structuredLogger.error("Failed to clear cache completely");
				// Still try to sync even if clear had issues
			}

			setPath("sync");
			// Force a fresh sync after clearing
			await updateSync(false); // Force full sync (not poll)
		} catch (err) {
			structuredLogger.error("Failed to reset cache and sync", err);
			// Still go back even on error so user isn't stuck
			goBackPage();
		}
	};

	const cancel = () => {
		goBackPage();
	};

	const actions = (
		<>
			<Button variant="contained" color="error" onClick={reset}>
				{translations.FULL_SYNC}
			</Button>
			<Button variant="contained" onClick={cancel}>
				{translations.CANCEL}
			</Button>
		</>
	);

	return (
		<Dialog title={translations.FULL_SYNC} onClose={cancel} actions={actions}>
			<Typography variant="body1">{translations.FULL_SYNC_MESSAGE}</Typography>
		</Dialog>
	);
}
