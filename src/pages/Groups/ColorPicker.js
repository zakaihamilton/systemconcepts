import React, { useState } from "react";
import { SwatchesPicker } from "react-color";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import styles from "./ColorPicker.module.scss";
import clsx from "clsx";

export default function ColorPicker({ name, color, pickerClassName, onChangeComplete }) {
    const [open, setOpen] = useState(false);

    const handleClick = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <div className={styles.swatch} onClick={handleClick}>
                <div className={styles.color} style={{ backgroundColor: color }} />
            </div>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                fullWidth={false}
                slotProps={{
                    paper: {
                        className: styles.dialogPaper
                    }
                }}
            >
                <div className={styles.pickerContainer}>
                    <DialogTitle className={styles.dialogTitle}>
                        {name[0].toUpperCase() + name.slice(1)}
                    </DialogTitle>
                    <SwatchesPicker
                        className={clsx(styles.picker, pickerClassName)}
                        color={color}
                        width={500}
                        height={380}
                        onChangeComplete={(newColor) => {
                            onChangeComplete(newColor);
                            handleClose();
                        }}
                    />
                </div>
            </Dialog>
        </>
    );
}
