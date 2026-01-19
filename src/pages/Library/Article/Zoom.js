import React, { useRef } from 'react';
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import styles from "./Zoom.module.scss";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTranslations } from "@util/translations";

export default function Zoom({ open, onClose, content, number, badgeClass, Renderer }) {
    const contentRef = useRef(null);
    const translations = useTranslations();

    const handleCopy = () => {
        const text = contentRef.current?.innerText;
        if (text) {
            navigator.clipboard.writeText(text);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogContent className={styles.root}>
                <Box className={styles.itemWrapper}>
                    {number && <span className={badgeClass}>{number}</span>}
                    <Tooltip title={translations.COPY} arrow>
                        <IconButton className={styles.copyButton} onClick={handleCopy} size="small">
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Typography
                        ref={contentRef}
                        variant="h5"
                        component="div"
                        className={styles.item}
                    >
                        {Renderer && <Renderer>{content}</Renderer>}
                    </Typography>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
