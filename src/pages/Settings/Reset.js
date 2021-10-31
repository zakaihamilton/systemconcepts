import { useTranslations } from "@util/translations";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { MainStore, MainStoreDefaults } from "@components/Main";
import Dialog from "@widgets/Dialog";
import { goBackPage } from "@util/pages";

export default function Reset() {
    const translations = useTranslations();

    const reset = () => {
        MainStore.update(s => {
            Object.assign(s, MainStoreDefaults);
        });
        goBackPage();
    };

    const cancel = () => {
        goBackPage();
    };

    const actions = (<>
        <Button variant="contained" color="primary" onClick={reset}>
            {translations.RESET}
        </Button>
        <Button variant="contained" onClick={cancel}>
            {translations.CANCEL}
        </Button>
    </>);

    return <Dialog title={translations.RESET_SETTINGS} onClose={cancel} actions={actions}>
        <Typography variant="body1">
            {translations.RESET_MESSAGE}
        </Typography>
    </Dialog>;
}
