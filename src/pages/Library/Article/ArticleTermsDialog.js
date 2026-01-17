
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

export default function ArticleTermsDialog({ open, onClose, terms }) {
    const translations = useTranslations();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
            <DialogTitle>{translations.ARTICLE_TERMS || "Article Terms"} ({terms.length})</DialogTitle>
            <DialogContent dividers>
                <List>
                    {terms.map((item, index) => {
                        const { term, trans, en, he } = item;
                        const label = trans || term;
                        return (
                            <React.Fragment key={index}>
                                <ListItem alignItems="flex-start">
                                    <ListItemText
                                        primary={
                                            <Typography variant="subtitle1" component="span" style={{ fontWeight: 'bold' }}>
                                                {label}
                                            </Typography>
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
                            <ListItemText primary={translations.NO_TERMS_FOUND || "No terms found"} />
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
