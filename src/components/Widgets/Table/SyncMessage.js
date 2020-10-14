import Typography from '@material-ui/core/Typography';
import SyncIcon from '@material-ui/icons/Sync';
import { useTranslations } from "@/util/translations";
import styles from "./SyncMessage.module.scss";

export default function SyncMessage({ show = true }) {
    const translations = useTranslations();
    if (!show) {
        return null;
    }
    return <div className={styles.root}>
        <SyncIcon className={styles.animated} />
        <Typography variant="h6">{translations.SYNCING}...</Typography>
    </div>;
}
