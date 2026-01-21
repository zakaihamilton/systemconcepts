import React, { useState, useMemo, useEffect } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { PHASE_COLORS, getStyleInfo } from "./GlossaryUtils";
import styles from "./ArticleTermsDialog.module.scss";

export default function ArticleTermsDialog({ open, onClose, terms, onJump }) {
    const translations = useTranslations();
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (open) {
            setSearch("");
        }
    }, [open]);

    const filteredTerms = useMemo(() => {
        if (!search) return terms;
        const lowerSearch = search.toLowerCase();
        return terms.filter(item => {
            const { term, trans, en, he } = item;
            return (
                term.toLowerCase().includes(lowerSearch) ||
                (trans && trans.toLowerCase().includes(lowerSearch)) ||
                (en && en.toLowerCase().includes(lowerSearch)) ||
                (he && he.includes(search))
            );
        });
    }, [terms, search]);

    const uniqueLetters = useMemo(() => {
        const letters = new Set();
        filteredTerms.forEach(item => {
            const label = item.trans || item.term;
            if (label) {
                letters.add(label.charAt(0).toUpperCase());
            }
        });
        return Array.from(letters).sort();
    }, [filteredTerms]);

    const [activeLetter, setActiveLetter] = useState(null);

    const handleScroll = (e) => {
        const container = e.target;
        const containerTop = container.getBoundingClientRect().top;

        // Find the first letter section that is visible or above the fold
        let currentLetter = null;

        for (const letter of uniqueLetters) {
            const element = document.getElementById(`term-letter-${letter}`);
            if (element) {
                const rect = element.getBoundingClientRect();
                // If the element is near the top of the container (allowing some buffer)
                if (rect.top <= containerTop + 50) {
                    currentLetter = letter;
                } else {
                    // Since specific letter sections are ordered, once we find one below the threshold,
                    // the PREVIOUS one was the current one.
                    break;
                }
            }
        }

        if (currentLetter !== activeLetter) {
            setActiveLetter(currentLetter);
        }
    };

    // Set initial active letter
    useEffect(() => {
        if (uniqueLetters.length > 0 && !activeLetter) {
            setActiveLetter(uniqueLetters[0]);
        }
    }, [uniqueLetters, activeLetter]);

    const handleLetterClick = (letter) => {
        const element = document.getElementById(`term-letter-${letter}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper" PaperProps={{ style: { height: '80vh' } }}>
            <DialogTitle disableTypography className={styles.titleContainer}>
                <Typography variant="h6">{translations.ARTICLE_TERMS} ({filteredTerms.length})</Typography>
                <div className={styles.searchContainer}>
                    <div className={styles.searchIcon}>
                        <SearchIcon color="inherit" />
                    </div>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder={translations.SEARCH}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <div className={`${styles.clearButton} ${!search ? styles.hidden : ''}`}>
                        <Tooltip title={translations.CLEAR}>
                            <IconButton size="small" onClick={() => setSearch("")}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            </DialogTitle>
            <div className={styles.dialogBody}>
                {uniqueLetters.length > 0 && (
                    <div className={styles.sidebar}>
                        {uniqueLetters.map(letter => (
                            <div
                                key={letter}
                                className={`${styles.letterLink} ${letter === activeLetter ? styles.active : ''}`}
                                onClick={() => handleLetterClick(letter)}
                            >
                                {letter}
                            </div>
                        ))}
                    </div>
                )}
                <DialogContent className={styles.content} onScroll={handleScroll} id="terms-dialog-content">
                    <List className={styles.list}>
                        {filteredTerms.map((item, index) => {
                            const { term, trans, en, he, style, paragraphs } = item;
                            const label = trans || term;
                            const firstChar = label.charAt(0).toUpperCase();
                            const prevLabel = index > 0 ? (filteredTerms[index - 1].trans || filteredTerms[index - 1].term) : null;
                            const isNewLetter = index === 0 || (prevLabel && prevLabel.charAt(0).toUpperCase() !== firstChar);

                            const styleInfo = getStyleInfo(style);
                            const phaseRaw = styleInfo?.phase;
                            const phaseKey = typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : null;
                            const phaseColor = phaseKey ? PHASE_COLORS[phaseKey] : null;
                            const phaseLabel = phaseKey ? phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1) : null;

                            const visibleParagraphs = paragraphs ? paragraphs.slice(0, 20) : [];
                            const hasMore = paragraphs && paragraphs.length > 20;

                            return (
                                <React.Fragment key={index}>
                                    <ListItem
                                        alignItems="flex-start"
                                        id={isNewLetter ? `term-letter-${firstChar}` : undefined}
                                    >
                                        <ListItemText
                                            primary={
                                                <div className={styles.termPrimary}>
                                                    <Typography variant="subtitle1" component="span" className={styles.termLabel}>
                                                        {index + 1}. {label}
                                                    </Typography>
                                                    {styleInfo?.category && (
                                                        <span className={styles.categoryBadge}>
                                                            {styleInfo.category}
                                                        </span>
                                                    )}
                                                    {phaseLabel && (
                                                        <span className={styles.phaseBadge} style={{ backgroundColor: phaseColor }}>
                                                            {phaseLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            }
                                            secondary={
                                                <div className={styles.termSecondary}>
                                                    <div className={styles.translationBlock}>
                                                        <Typography variant="body2" component="span" color="textPrimary">
                                                            {en}
                                                        </Typography>
                                                        {he && (
                                                            <Typography variant="body2" component="span" className={styles.hebrewTranslation}>
                                                                — {he}
                                                            </Typography>
                                                        )}
                                                    </div>
                                                    {paragraphs && paragraphs.length > 0 && (
                                                        <div className={styles.paragraphContainer}>
                                                            {visibleParagraphs.map(p => (
                                                                <span
                                                                    key={p}
                                                                    className={styles.paragraphBadge}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onClose();
                                                                        onJump(p);
                                                                    }}
                                                                    title={`${translations.JUMP_TO} ${p}`}
                                                                >
                                                                    {p}
                                                                </span>
                                                            ))}
                                                            {hasMore && (
                                                                <Typography variant="caption" color="textSecondary" style={{ marginLeft: '4px' }}>
                                                                    ... (+{paragraphs.length - 20})
                                                                </Typography>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                        />
                                    </ListItem>
                                    {index < filteredTerms.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            );
                        })}
                        {filteredTerms.length === 0 && (
                            <ListItem>
                                <ListItemText primary={translations.NO_TERMS_FOUND} />
                            </ListItem>
                        )}
                    </List>
                </DialogContent>
            </div>
            <DialogActions>
                <Button onClick={onClose}>{translations.CLOSE}</Button>
            </DialogActions>
        </Dialog>
    );
}
