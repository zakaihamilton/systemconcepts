import Typography from '@material-ui/core/Typography';
import WarningIcon from '@material-ui/icons/Warning';
import { useTranslations } from "@/util/translations";
import styles from "./EmptyMessage.module.scss";

export default function EmptyMessage({ show = true }) {
    const translations = useTranslations();
    if (!show) {
        return null;
    }
    return <div className={styles.root}>
        <WarningIcon />
        <Typography variant="h6">{translations.NO_ITEMS}</Typography>
    </div>;
}
