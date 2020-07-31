import { useTranslations } from "@/util/translations";
import Typography from '@material-ui/core/Typography';
import Button from "@/widgets/Button";
import { MainStore, MainStoreDefaults } from "@/components/Main";
import Dialog from "@/widgets/Dialog";

export default function Reset() {
    const translations = useTranslations();

    const reset = () => {
        MainStore.update(s => {
            Object.assign(s, MainStoreDefaults);
        });
        window.location.hash = encodeURI("/settings");
    };

    const cancel = () => {
        window.location.hash = encodeURI("/settings");
    };

    const actions = (<>
        <Button color="primary" onClick={reset}>
            {translations.RESET}
        </Button>
        <Button onClick={cancel}>
            {translations.CANCEL}
        </Button>
    </>);

    return <Dialog title={translations.RESET_SETTINGS} onClose={cancel} actions={actions}>
        <Typography variant="body1">
            {translations.RESET_MESSAGE}
        </Typography>
    </Dialog>;
}
