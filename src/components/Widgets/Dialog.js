import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import styles from "./Dialog.module.scss";
import Tooltip from "@mui/material/Tooltip";
import CancelIcon from "@mui/icons-material/Cancel";
import { IconButton } from "@mui/material";
import clsx from "clsx";

export default function Dialog({ title, children, actions, onClose, className, ...props }) {
    const translations = useTranslations();

    return (
        <div className={styles.root} onClick={onClose} {...props}>
            <div className={styles.background} onClick={e => e.stopPropagation()}>
                <div className={clsx(styles.dialog, className)}>
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
                    {!!actions && <div className={styles.actions}>
                        {actions}
                    </div>}
                </div>
            </div>
        </div>
    );
}
