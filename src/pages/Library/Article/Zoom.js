import React, { useRef, useEffect, useCallback } from 'react';
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import styles from "./Zoom.module.scss";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTranslations } from "@util/translations";
import { useSwipe } from "@util/touch";

export default function Zoom({ open, onClose, content, number, badgeClass, Renderer, copyExcludeSelectors, onNavigate }) {
    const contentRef = useRef(null);
    const translations = useTranslations();

    const handleCopy = () => {
        let text = "";
        if (contentRef.current) {
            if (copyExcludeSelectors && copyExcludeSelectors.length) {
                const clone = contentRef.current.cloneNode(true);
                copyExcludeSelectors.forEach(selector => {
                    const elements = clone.querySelectorAll(selector);
                    elements.forEach(element => element.remove());
                });
                text = clone.innerText;
            } else {
                text = contentRef.current.innerText;
            }
        }
        if (text) {
            navigator.clipboard.writeText(text.replace(/\r?\n|\r/g, " "));
        }
    };

    const handlePrevious = useCallback(() => {
        if (onNavigate) {
            onNavigate(number - 1);
        }
    }, [onNavigate, number]);

    const handleNext = useCallback(() => {
        if (onNavigate) {
            onNavigate(number + 1);
        }
    }, [onNavigate, number]);

    const swipeHandlers = useSwipe({
        onSwipeDown: handlePrevious,
        onSwipeUp: handleNext
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!open) return;
            if (e.key === "ArrowUp") {
                e.preventDefault();
                handlePrevious();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                handleNext();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, handlePrevious, handleNext]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogContent className={styles.root} {...swipeHandlers}>
                <Box className={styles.itemWrapper}>
                    {number && <span className={`${badgeClass} ${styles.badge}`}>{number}</span>}
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
