import React, { useState, useEffect } from "react";
import { SketchPicker } from "react-color";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useTranslations } from "@util/translations";
import { getColorName } from "@util/color";
import styles from "./ColorPicker.module.scss";
import clsx from "clsx";

export default function ColorPicker({ name, color, pickerClassName, onChangeComplete }) {
    const translations = useTranslations();
    const [open, setOpen] = useState(false);
    const [currentColor, setCurrentColor] = useState(color);

    useEffect(() => {
        if (open) {
            setCurrentColor(color);
        }
    }, [open, color]);

    const handleClick = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleSave = () => {
        onChangeComplete({ hex: currentColor });
        setOpen(false);
    };

    const colorName = getColorName(currentColor, translations);

    return (
        <>
            <div className={styles.swatch} onClick={handleClick}>
                {color ? <div className={styles.color} style={{ backgroundColor: color }} /> : <div className={styles.noColor} />}
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
                    <DialogContent className={styles.dialogContent}>
                        <div className={styles.nameContainer}>
                            <Typography className={styles.colorName}>
                                {colorName}
                            </Typography>
                            <Typography className={styles.hexCode}>
                                {currentColor?.toUpperCase()}
                            </Typography>
                        </div>
                        <SketchPicker
                            className={clsx(styles.picker, pickerClassName)}
                            color={currentColor || "#FFFFFF"}
                            width={400}
                            onChange={(color) => {
                                setCurrentColor(color.hex);
                            }}
                        />
                    </DialogContent>
                    <DialogActions className={styles.dialogActions}>
                        <Button
                            onClick={handleSave}
                            variant="contained"
                            className={styles.saveButton}
                        >
                            {translations.OK}
                        </Button>
                        <Button
                            onClick={() => setCurrentColor("")}
                            className={styles.noneButton}
                        >
                            {translations.NONE}
                        </Button>
                        <Button
                            onClick={handleClose}
                            className={styles.cancelButton}
                        >
                            {translations.CANCEL}
                        </Button>
                    </DialogActions>
                </div>
            </Dialog>
        </>
    );
}
