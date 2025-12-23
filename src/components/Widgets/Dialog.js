import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import styles from "./Dialog.module.scss";
import Tooltip from "@mui/material/Tooltip";
import CancelIcon from "@mui/icons-material/Cancel";
import { IconButton } from "@mui/material";

export default function Dialog({ title, children, actions, onClose }) {
    const translations = useTranslations();

    return (
        <div className={styles.root} onClick={onClose}>
            <div className={styles.background} onClick={e => e.stopPropagation()}>
                <div className={styles.dialog}>
                    <div className={styles.title}>
                        <Typography variant="h6">
                            {title}
                        </Typography>
                        <div style={{ flex: 1 }} />
                        <IconButton className={styles.closeDialog} onClick={onClose} size="large">
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
        </div>
    );
}
