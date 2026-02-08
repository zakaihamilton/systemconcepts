import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import { LibraryTagKeys } from "@pages/Library/Icons";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import EditAttributesIcon from "@mui/icons-material/EditAttributes";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import styles from "./BatchDialog.module.scss";

export default function BatchDialog({ open, onClose, tags, loadTags }) {
    const translations = useTranslations();
    const [processing, setProcessing] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    const [filterKey, setFilterKey] = useState("");
    const [filterValue, setFilterValue] = useState("");
    const [sourceKey, setSourceKey] = useState("");
    const [sourceValue, setSourceValue] = useState("");
    const [destKey, setDestKey] = useState("");
    const [destValue, setDestValue] = useState("");

    useEffect(() => {
        if (open) {
            setFilterKey("");
            setFilterValue("");
            setSourceKey("");
            setSourceValue("");
            setDestKey("");
            setDestValue("");
            setPreviewData(null);
        }
    }, [open]);

    const uniqueValues = useMemo(() => {
        const values = {};
        LibraryTagKeys.forEach(key => {
            values[key] = new Set();
        });
        tags.forEach(tag => {
            LibraryTagKeys.forEach(key => {
                if (tag[key]) {
                    values[key].add(tag[key]);
                }
            });
        });
        return values;
    }, [tags]);

    const getUniqueValues = (key) => {
        if (!key || !uniqueValues[key]) return [];
        return Array.from(uniqueValues[key]).sort();
    };

    const handlePreview = () => {
        setCalculating(true);
        try {
            const affectedItems = tags.filter(tag => {
                const matchFilter = !filterKey || (tag[filterKey] === filterValue);
                const matchSource = tag.hasOwnProperty(sourceKey) && (!sourceValue || tag[sourceKey] === sourceValue);
                return matchFilter && matchSource;
            });

            const files = {};
            affectedItems.forEach(tag => {
                if (!files[tag.path]) {
                    files[tag.path] = [];
                }
                files[tag.path].push(tag);
            });

            const changes = Object.entries(files).map(([path, fileTags]) => ({
                path,
                count: fileTags.length,
                items: fileTags.map(t => t.article || t.title || t.name || t._id)
            }));

            setPreviewData(changes);
        } catch (err) {
            console.error(err);
        } finally {
            setCalculating(false);
        }
    };

    const handleUpdate = async () => {
        setProcessing(true);
        try {
            // 1. Update tags.json local state copy
            // Note: We need to deep copy because we are modifying nested props potentially?
            // Actually tags array is flat objects.

            const relevantTags = tags.filter(tag => {
                const matchFilter = !filterKey || (tag[filterKey] === filterValue);
                const matchSource = tag.hasOwnProperty(sourceKey) && (!sourceValue || tag[sourceKey] === sourceValue);
                return matchFilter && matchSource;
            });

            const filePaths = Array.from(new Set(relevantTags.map(t => t.path)));

            // Update items in files
            for (const relativePath of filePaths) {
                const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
                if (await storage.exists(filePath)) {
                    const content = await storage.readFile(filePath);
                    let data = JSON.parse(content);
                    let changed = false;

                    const relevantIds = relevantTags.filter(t => t.path === relativePath).map(t => t._id);

                    const updateItem = (item) => {
                        if (relevantIds.includes(item._id)) {
                            // Verify double check
                            const matchFilter = !filterKey || (item[filterKey] === filterValue);
                            const matchSource = item.hasOwnProperty(sourceKey) && (!sourceValue || item[sourceKey] === sourceValue);

                            if (matchFilter && matchSource) {
                                const originalValue = item[sourceKey];
                                delete item[sourceKey];
                                item[destKey] = destValue || originalValue;
                                return true;
                            }
                        }
                        return false;
                    };

                    if (Array.isArray(data)) {
                        data = data.map(item => {
                            if (updateItem(item)) {
                                changed = true;
                            }
                            return item;
                        });
                    } else if (data._id) {
                        // Singular file
                        if (updateItem(data)) {
                            changed = true;
                        }
                    }

                    if (changed) {
                        await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                    }
                }
            }

            // Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            // We can reuse the loadTags from parent or just replicate logic
            // But better to update the tags array and save it.
            const updatedTags = tags.map(tag => {
                const matchFilter = !filterKey || (tag[filterKey] === filterValue);
                const matchSource = tag.hasOwnProperty(sourceKey) && (!sourceValue || tag[sourceKey] === sourceValue);

                if (matchFilter && matchSource) {
                    const newTag = { ...tag };
                    const originalValue = newTag[sourceKey];
                    delete newTag[sourceKey];
                    newTag[destKey] = destValue || originalValue;
                    return newTag;
                }
                return tag;
            });
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            if (loadTags) {
                await loadTags();
            }

            onClose();

        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    const isValid = sourceKey && destKey;

    return (
        <Dialog
            open={open}
            onClose={() => !processing && onClose()}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {translations.BATCH_UPDATE_TAGS}
            </DialogTitle>
            <DialogContent dividers>
                <div className={styles.container}>
                    <div className={styles.section}>
                        <Typography variant="subtitle2">
                            {translations.FILTER_CONDITION}
                        </Typography>
                        <div className={styles.field}>
                            <TextField
                                select
                                fullWidth
                                label={translations.KEY}
                                value={filterKey}
                                onChange={e => { setFilterKey(e.target.value); setFilterValue(""); setPreviewData(null); }}
                            >
                                {LibraryTagKeys.map(key => (
                                    <MenuItem key={key} value={key}>{key}</MenuItem>
                                ))}
                            </TextField>
                        </div>
                        <div className={styles.field}>
                            <TextField
                                select
                                fullWidth
                                label={translations.VALUE}
                                value={filterValue}
                                onChange={e => { setFilterValue(e.target.value); setPreviewData(null); }}
                                disabled={!filterKey}
                            >
                                {getUniqueValues(filterKey).map(val => (
                                    <MenuItem key={val} value={val}>{val}</MenuItem>
                                ))}
                                <MenuItem value=""><em>{translations.ALL}</em></MenuItem>
                            </TextField>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <Typography variant="subtitle2">
                            {translations.CHANGE_FROM}
                        </Typography>
                        <div className={styles.field}>
                            <TextField
                                select
                                fullWidth
                                label={translations.SOURCE_KEY}
                                value={sourceKey}
                                onChange={e => { setSourceKey(e.target.value); setSourceValue(""); setPreviewData(null); }}
                            >
                                {LibraryTagKeys.map(key => (
                                    <MenuItem key={key} value={key}>{key}</MenuItem>
                                ))}
                            </TextField>
                        </div>
                        <div className={styles.field}>
                            <TextField
                                select
                                fullWidth
                                label={translations.SOURCE_VALUE}
                                value={sourceValue}
                                onChange={e => { setSourceValue(e.target.value); setPreviewData(null); }}
                                disabled={!sourceKey}
                            >
                                {getUniqueValues(sourceKey).map(val => (
                                    <MenuItem key={val} value={val}>{val}</MenuItem>
                                ))}
                                <MenuItem value=""><em>{translations.ALL}</em></MenuItem>
                            </TextField>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <Typography variant="subtitle2">
                            {translations.CHANGE_TO}
                        </Typography>
                        <div className={styles.field}>
                            <TextField
                                select
                                fullWidth
                                label={translations.DESTINATION_KEY}
                                value={destKey}
                                onChange={e => setDestKey(e.target.value)}
                            >
                                {LibraryTagKeys.map(key => (
                                    <MenuItem key={key} value={key}>{key}</MenuItem>
                                ))}
                            </TextField>
                        </div>
                        <div className={styles.field}>
                            <TextField
                                fullWidth
                                label={translations.DESTINATION_VALUE}
                                value={destValue}
                                onChange={e => setDestValue(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={handlePreview}
                        disabled={!isValid || calculating || processing}
                    >
                        {translations.PREVIEW}
                    </Button>
                </Box>

                {calculating && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                )}

                {previewData && (
                    <Box sx={{ mt: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <List dense>
                            {previewData.length === 0 ? (
                                <ListItem>
                                    <ListItemText primary={translations.NO_MATCHING_ITEMS} />
                                </ListItem>
                            ) : (
                                previewData.map((item, index) => (
                                    <React.Fragment key={index}>
                                        <PreviewItem item={item} translations={translations} />
                                        {index < previewData.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))
                            )}
                        </List>
                        {previewData.length > 0 && (
                            <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                                <Typography variant="caption">
                                    {translations.TOTAL_FILES}: {previewData.length} |
                                    {translations.TOTAL_ITEMS}: {previewData.reduce((acc, curr) => acc + curr.count, 0)}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={() => (!processing && onClose())}>
                    {translations.CANCEL}
                </Button>
                <Button
                    onClick={handleUpdate}
                    variant="contained"
                    disabled={!previewData || previewData.length === 0 || processing}
                    startIcon={<EditAttributesIcon />}
                >
                    {processing ? (translations.UPDATING) : (translations.UPDATE)}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function PreviewItem({ item, translations }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <ListItem
                secondaryAction={
                    <IconButton edge="end" onClick={() => setOpen(!open)}>
                        {open ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                }
            >
                <ListItemText
                    primary={item.path}
                    secondary={`${translations.MATCHING_ITEMS}: ${item.count}`}
                />
            </ListItem>
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List component="div" disablePadding dense>
                    {item.items.map((subItem, idx) => (
                        <ListItem key={idx} sx={{ pl: 4 }}>
                            <ListItemText primary={subItem} />
                        </ListItem>
                    ))}
                </List>
            </Collapse>
        </>
    );
}
