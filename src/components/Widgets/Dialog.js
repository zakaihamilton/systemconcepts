import { useTranslations } from "@util/translations";
import Typography from "@material-ui/core/Typography";
import styles from "./Dialog.module.scss";
import Tooltip from "@material-ui/core/Tooltip";
import CancelIcon from "@material-ui/icons/Cancel";
import { IconButton } from "@material-ui/core";

export default function Dialog({ title, children, actions, onClose }) {
    const translations = useTranslations();

    return <div className={styles.root}>
        <div className={styles.background}>
            <div className={styles.dialog}>
                <div className={styles.title}>
                    <Typography variant="h6">
                        {title}
                    </Typography>
                    <div style={{ flex: 1 }} />
                    <IconButton className={styles.closeDialog} onClick={onClose}>
                        <Tooltip title={translations.CLOSE} arrow>
                            <CancelIcon />
                        </Tooltip>
                    </IconButton>
                </div>
                <div className={styles.content}>
                    {children}
                </div>
                <div className={styles.actions}>
                    {actions}
                </div>
            </div>
        </div>
    </div>;
}
