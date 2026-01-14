import { useState, useCallback, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import { analyzeContent } from "./contentParsers";
import { LibraryStore } from "./Store";

export default function AutoFillTagsDialog({
    open,
    onClose,
    tags,
    setTags
}) {
    const translations = useTranslations();
    const [scanning, setScanning] = useState(false);
    const [applying, setApplying] = useState(false);
    const [matches, setMatches] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const [fieldFilter, setFieldFilter] = useState(null); // null = all fields

    const scanArticles = useCallback(async () => {
        setScanning(true);
        setMatches([]);
        setSelected(new Set());

        const results = [];
        const total = tags.length;
        setScanProgress({ current: 0, total });

        // Group tags by path to minimize file reads
        const tagsByPath = {};
        tags.forEach(tag => {
            if (tag.path) {
                if (!tagsByPath[tag.path]) {
                    tagsByPath[tag.path] = [];
                }
                tagsByPath[tag.path].push(tag);
            }
        });

        let processed = 0;
        for (const [path, pathTags] of Object.entries(tagsByPath)) {
            try {
                const filePath = makePath(LIBRARY_LOCAL_PATH, path);
                if (await storage.exists(filePath)) {
                    const content = await storage.readFile(filePath);
                    const data = JSON.parse(content);

                    for (const tag of pathTags) {
                        let item = null;
                        if (Array.isArray(data)) {
                            item = data.find(i => i._id === tag._id);
                        } else if (data._id === tag._id) {
                            item = data;
                        }

                        if (item && item.text) {
                            const suggestions = analyzeContent(item.text, tag);

                            for (const [field, suggestedValue] of Object.entries(suggestions)) {
                                const matchId = `${tag._id}|${field}`;
                                results.push({
                                    id: matchId,
                                    tagId: tag._id,
                                    path: tag.path,
                                    articleName: tag.article || tag.title || tag.chapter || "Unknown",
                                    field,
                                    currentValue: tag[field] || null,
                                    suggestedValue,
                                    isMissing: !tag[field]
                                });
                            }
                        }

                        processed++;
                        setScanProgress({ current: processed, total });
                    }
                }
            } catch (err) {
                console.error(`Failed to scan ${path}:`, err);
            }
        }

        // Pre-select matches where the field is missing
        const preSelected = new Set(
            results.filter(m => m.isMissing).map(m => m.id)
        );

        setMatches(results);
        setSelected(preSelected);
        setScanning(false);
    }, [tags]);

    useEffect(() => {
        if (open) {
            scanArticles();
        }
    }, [open, scanArticles]);

    const handleToggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Get unique fields from matches
    const availableFields = useMemo(() => {
        const fields = new Set(matches.map(m => m.field));
        return Array.from(fields).sort();
    }, [matches]);

    // Filter matches based on field filter
    const filteredMatches = useMemo(() => {
        if (!fieldFilter) return matches;
        return matches.filter(m => m.field === fieldFilter);
    }, [matches, fieldFilter]);

    // Count selected items in current filter
    const filteredSelectedCount = useMemo(() => {
        return filteredMatches.filter(m => selected.has(m.id)).length;
    }, [filteredMatches, selected]);

    const handleSelectAll = () => {
        setSelected(prev => {
            const next = new Set(prev);
            filteredMatches.forEach(m => next.add(m.id));
            return next;
        });
    };

    const handleSelectNone = () => {
        setSelected(prev => {
            const next = new Set(prev);
            filteredMatches.forEach(m => next.delete(m.id));
            return next;
        });
    };

    const handleApply = async () => {
        if (selected.size === 0) return;

        setApplying(true);
        try {
            // Group selected matches by tagId
            const changesByTag = {};
            matches.filter(m => selected.has(m.id)).forEach(m => {
                if (!changesByTag[m.tagId]) {
                    changesByTag[m.tagId] = {};
                }
                changesByTag[m.tagId][m.field] = m.suggestedValue;
            });

            // Update tags array
            const updatedTags = tags.map(tag => {
                if (changesByTag[tag._id]) {
                    return { ...tag, ...changesByTag[tag._id] };
                }
                return tag;
            });

            // Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            // Update individual article files
            const fileChanges = {};
            matches.filter(m => selected.has(m.id)).forEach(m => {
                if (!fileChanges[m.path]) {
                    fileChanges[m.path] = {};
                }
                if (!fileChanges[m.path][m.tagId]) {
                    fileChanges[m.path][m.tagId] = {};
                }
                fileChanges[m.path][m.tagId][m.field] = m.suggestedValue;
            });

            for (const [path, tagChanges] of Object.entries(fileChanges)) {
                const filePath = makePath(LIBRARY_LOCAL_PATH, path);
                if (await storage.exists(filePath)) {
                    const content = await storage.readFile(filePath);
                    let data = JSON.parse(content);

                    if (Array.isArray(data)) {
                        data = data.map(item => {
                            if (tagChanges[item._id]) {
                                return { ...item, ...tagChanges[item._id] };
                            }
                            return item;
                        });
                    } else if (data._id && tagChanges[data._id]) {
                        Object.assign(data, tagChanges[data._id]);
                    }

                    await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                }
            }

            // Update state
            setTags(updatedTags);
            LibraryStore.update(s => {
                s.tags = updatedTags;
            });

            onClose();
        } catch (err) {
            console.error("Failed to apply changes:", err);
        } finally {
            setApplying(false);
        }
    };

    const handleClose = () => {
        if (!scanning && !applying) {
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AutoFixHighIcon />
                {translations.AUTO_FILL_TAGS || "Auto-Fill Tags"}
            </DialogTitle>
            <DialogContent>
                {scanning ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2 }}>
                        <CircularProgress />
                        <Typography>
                            {translations.SCANNING_ARTICLES || "Scanning articles..."}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {scanProgress.current} / {scanProgress.total}
                        </Typography>
                    </Box>
                ) : matches.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: "center" }}>
                        <Typography color="text.secondary">
                            {translations.NO_SUGGESTIONS_FOUND || "No suggestions found. All tags appear to be filled."}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Field Filter */}
                        {availableFields.length > 1 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                    {translations.FILTER_BY_FIELD || "Filter by field"}
                                </Typography>
                                <ToggleButtonGroup
                                    value={fieldFilter}
                                    exclusive
                                    onChange={(e, value) => setFieldFilter(value)}
                                    size="small"
                                >
                                    <ToggleButton value={null}>
                                        {translations.ALL || "All"}
                                    </ToggleButton>
                                    {availableFields.map(field => (
                                        <ToggleButton key={field} value={field} sx={{ textTransform: "capitalize" }}>
                                            {field} ({matches.filter(m => m.field === field).length})
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>
                        )}
                        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                            <Button
                                size="small"
                                startIcon={<CheckBoxIcon />}
                                onClick={handleSelectAll}
                            >
                                {translations.SELECT_ALL || "Select All"}
                            </Button>
                            <Button
                                size="small"
                                startIcon={<CheckBoxOutlineBlankIcon />}
                                onClick={handleSelectNone}
                            >
                                {translations.SELECT_NONE || "Select None"}
                            </Button>
                            <Box sx={{ flex: 1 }} />
                            <Chip
                                label={`${filteredSelectedCount} / ${filteredMatches.length} ${translations.SELECTED || "selected"}`}
                                size="small"
                                color={filteredSelectedCount > 0 ? "primary" : "default"}
                            />
                        </Box>
                        <TableContainer sx={{ maxHeight: 400 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox" />
                                        <TableCell>{translations.ARTICLE || "Article"}</TableCell>
                                        <TableCell>{translations.FIELD || "Field"}</TableCell>
                                        <TableCell>{translations.CURRENT || "Current"}</TableCell>
                                        <TableCell>{translations.SUGGESTED || "Suggested"}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredMatches.map(match => (
                                        <TableRow
                                            key={match.id}
                                            hover
                                            onClick={() => handleToggle(match.id)}
                                            sx={{ cursor: "pointer" }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selected.has(match.id)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {match.articleName}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={match.field}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ textTransform: "capitalize" }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {match.currentValue ? (
                                                    <Typography variant="body2">{match.currentValue}</Typography>
                                                ) : (
                                                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                                                        {translations.EMPTY || "empty"}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={match.suggestedValue}
                                                    size="small"
                                                    color="success"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={handleClose} disabled={scanning || applying}>
                    {translations.CANCEL || "Cancel"}
                </Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                    disabled={scanning || applying || selected.size === 0}
                >
                    {applying
                        ? (translations.APPLYING || "Applying...")
                        : `${translations.APPLY || "Apply"} (${selected.size})`
                    }
                </Button>
            </DialogActions>
        </Dialog>
    );
}
