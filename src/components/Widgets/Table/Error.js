import styles from "./Error.module.scss";
import ErrorIcon from '@material-ui/icons/Error';
import Label from "@widgets/Label";
import Tooltip from '@material-ui/core/Tooltip';
import { useTranslations } from "@util/translations";

export default function Error({ error }) {
    const translations = useTranslations();
    const text = translations[error] || error;
    return <Label
        className={styles.root}
        icon={<Tooltip title={translations.ERROR} arrow>
            <ErrorIcon />
        </Tooltip>}
        name={text} />;
}
