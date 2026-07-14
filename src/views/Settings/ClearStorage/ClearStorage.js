import { clear } from "@storage/local";
import Button from "@ui/Button";
import Typography from "@ui/Typography";
import { useTranslations } from "@util/domain/translations";
import { goBackPage, replacePath } from "@util/domain/views";
import Dialog from "@widgets/Dialog";

export default function ClearStorage() {
	const translations = useTranslations();

	const reset = async () => {
		await clear();
		localStorage.clear();
		replacePath("");
		window.location.reload();
	};

	const cancel = () => {
		goBackPage();
	};

	const actions = (
		<>
			<Button variant="contained" color="error" onClick={reset}>
				{translations.CLEAR_STORAGE}
			</Button>
			<Button variant="contained" onClick={cancel}>
				{translations.CANCEL}
			</Button>
		</>
	);

	return (
		<Dialog
			title={translations.CLEAR_STORAGE}
			onClose={cancel}
			actions={actions}
		>
			<Typography variant="body1">
				{translations.CONFIRM_CLEAR_STORAGE}
			</Typography>
		</Dialog>
	);
}
