import React from 'react';
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import styles from "./Zoom.module.scss";

export default function Zoom({ open, onClose, content, number, badgeClass, Renderer }) {
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
                    <Typography
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
