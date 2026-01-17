
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import { useTranslations } from "@util/translations";
import Typography from '@mui/material/Typography';
import { PHASE_COLORS, getStyleInfo } from "./GlossaryUtils";

export default function ArticleTermsDialog({ open, onClose, terms }) {
    const translations = useTranslations();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
            <DialogTitle>{translations.ARTICLE_TERMS} ({terms.length})</DialogTitle>
            <DialogContent dividers>
                <List>
                    {terms.map((item, index) => {
                        const { term, trans, en, he, style } = item;
                        const label = trans || term;
                        const styleInfo = getStyleInfo(style);
                        const phaseRaw = styleInfo?.phase;
                        const phaseKey = typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : null;
                        const phaseColor = phaseKey ? PHASE_COLORS[phaseKey] : null;
                        const phaseLabel = phaseKey ? phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1) : null;

                        return (
                            <React.Fragment key={index}>
                                <ListItem alignItems="flex-start">
                                    <ListItemText
                                        primary={
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <Typography variant="subtitle1" component="span" style={{ fontWeight: 'bold' }}>
                                                    {index + 1}. {label}
                                                </Typography>
                                                {styleInfo?.category && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        background: '#eee',
                                                        color: '#333',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        marginLeft: '8px',
                                                        border: '1px solid rgba(0,0,0,0.1)'
                                                    }}>
                                                        {styleInfo.category}
                                                    </span>
                                                )}
                                                {phaseLabel && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        background: phaseColor,
                                                        color: '#000',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        marginLeft: '8px',
                                                        border: '1px solid rgba(0,0,0,0.1)'
                                                    }}>
                                                        {phaseLabel}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                        secondary={
                                            <React.Fragment>
                                                <Typography variant="body2" component="span" color="textPrimary">
                                                    {en}
                                                </Typography>
                                                {he && (
                                                    <Typography variant="body2" component="span" style={{ marginLeft: '8px', direction: 'rtl' }}>
                                                        — {he}
                                                    </Typography>
                                                )}
                                            </React.Fragment>
                                        }
                                    />
                                </ListItem>
                                {index < terms.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                        );
                    })}
                    {terms.length === 0 && (
                        <ListItem>
                            <ListItemText primary={translations.NO_TERMS_FOUND} />
                        </ListItem>
                    )}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{translations.CLOSE}</Button>
            </DialogActions>
        </Dialog>
    );
}
