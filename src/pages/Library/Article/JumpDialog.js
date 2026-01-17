
import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { useTranslations } from "@util/translations";

export default function JumpDialog({ open, onClose, onSubmit, maxPage = 1 }) {
    const translations = useTranslations();
    const [tab, setTab] = useState(0); // 0: Paragraph, 1: Page
    const [paragraphNumber, setParagraphNumber] = useState('');
    const [pageNumber, setPageNumber] = useState('');

    useEffect(() => {
        if (open) {
            // Reset fields or focus?
            // Keep previous values?
        }
    }, [open]);

    const handleSubmit = () => {
        if (tab === 0) {
            const val = parseInt(paragraphNumber, 10);
            if (!isNaN(val) && val > 0) {
                onSubmit('paragraph', val);
                setParagraphNumber('');
            }
        } else {
            const val = parseInt(pageNumber, 10);
            if (!isNaN(val) && val > 0 && val <= maxPage) {
                onSubmit('page', val);
                setPageNumber('');
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                {translations.JUMP_TO}
            </DialogTitle>
            <DialogContent>
                <Tabs
                    value={tab}
                    onChange={(e, val) => setTab(val)}
                    variant="fullWidth"
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ marginBottom: 2 }}
                >
                    <Tab label={translations.PARAGRAPH} />
                    <Tab label={translations.PAGE} />
                </Tabs>

                {tab === 0 && (
                    <TextField
                        autoFocus
                        margin="dense"
                        id="paragraph-number"
                        label={translations.PARAGRAPH_NUMBER}
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={paragraphNumber}
                        onChange={(e) => setParagraphNumber(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                )}

                {tab === 1 && (
                    <Box>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="page-number"
                            label={`${translations.PAGE_NUMBER} (1-${maxPage})`}
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={pageNumber}
                            onChange={(e) => setPageNumber(e.target.value)}
                            onKeyDown={handleKeyDown}
                            InputProps={{ inputProps: { min: 1, max: maxPage } }}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{translations.CANCEL}</Button>
                <Button onClick={handleSubmit}>{translations.GO}</Button>
            </DialogActions>
        </Dialog>
    );
}
