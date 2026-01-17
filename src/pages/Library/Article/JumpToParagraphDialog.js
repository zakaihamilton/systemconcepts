
import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useTranslations } from "@util/translations";

export default function JumpToParagraphDialog({ open, onClose, onSubmit }) {
    const translations = useTranslations();
    const [number, setNumber] = useState('');

    const handleSubmit = () => {
        const val = parseInt(number, 10);
        if (!isNaN(val) && val > 0) {
            onSubmit(val);
            setNumber('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{translations.JUMP_TO_PARAGRAPH || "Jump to Paragraph"}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    id="paragraph-number"
                    label={translations.PARAGRAPH_NUMBER || "Paragraph Number"}
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{translations.CANCEL}</Button>
                <Button onClick={handleSubmit}>{translations.GO || "Go"}</Button>
            </DialogActions>
        </Dialog>
    );
}
