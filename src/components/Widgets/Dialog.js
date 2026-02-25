import { useEffect, useId, useRef } from "react";
import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import styles from "./Dialog.module.scss";
import Tooltip from "@mui/material/Tooltip";
import CancelIcon from "@mui/icons-material/Cancel";
import { IconButton } from "@mui/material";
import clsx from "clsx";

export default function Dialog({ title, children, actions, onClose, className, ...props }) {
    const translations = useTranslations();
    const titleId = useId();
    const dialogRef = useRef(null);

    useEffect(() => {
        if (dialogRef.current) {
            dialogRef.current.focus();
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && onClose) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className={styles.root} onClick={onClose} {...props}>
            <div className={styles.background} onClick={e => e.stopPropagation()}>
                <div
                    className={clsx(styles.dialog, className)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    ref={dialogRef}
                >
                    <div className={styles.title}>
                        <Typography variant="h6" id={titleId}>
                            {title}
                        </Typography>
                        <div style={{ flex: 1 }} />
                        <Tooltip title={translations.CLOSE} arrow>
                            <IconButton
                                className={styles.closeDialog}
                                onClick={onClose}
                                size="large"
                                aria-label={translations.CLOSE}
                            >
                                <CancelIcon />
                            </IconButton>
                        </Tooltip>
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
