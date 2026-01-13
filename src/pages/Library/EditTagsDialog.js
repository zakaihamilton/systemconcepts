import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import { LibraryTagKeys } from "./Icons";
import { LibraryStore } from "./Store";

export default function EditTagsDialog({
    open,
    onClose,
    selectedTag,
    tags,
    setTags,
    setSelectedTag,
    setContent
}) {
    const translations = useTranslations();
    const [editFormValues, setEditFormValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Initialize form values when dialog opens
    const initializeForm = () => {
        if (selectedTag) {
            const formValues = {};
            LibraryTagKeys.forEach(key => {
                formValues[key] = selectedTag[key] || "";
            });
            formValues.number = selectedTag.number || "";
            setEditFormValues(formValues);
            setIdCopied(false);
            setShowDeleteConfirm(false);
        }
    };

    const copyIdToClipboard = async () => {
        if (selectedTag?._id) {
            try {
                await navigator.clipboard.writeText(selectedTag._id);
                setIdCopied(true);
                setTimeout(() => setIdCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy ID:", err);
            }
        }
    };

    const handleEditChange = (key) => (event) => {
        setEditFormValues(prev => ({
            ...prev,
            [key]: event.target.value
        }));
    };

    const handleSaveEdit = async () => {
        if (!selectedTag) return;
        setSaving(true);
        try {
            // Update the tag in the tags array
            const updatedTag = { ...selectedTag };
            LibraryTagKeys.forEach(key => {
                if (editFormValues[key] !== undefined) {
                    updatedTag[key] = editFormValues[key] || null;
                }
            });
            if (editFormValues.number !== undefined) {
                updatedTag.number = editFormValues.number || null;
            }

            // Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            const updatedTags = tags.map(t => t._id === selectedTag._id ? updatedTag : t);
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            // Update the article file
            const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
            if (await storage.exists(filePath)) {
                const fileContent = await storage.readFile(filePath);
                const data = JSON.parse(fileContent);
                if (Array.isArray(data)) {
                    const updatedData = data.map(item => {
                        if (item._id === selectedTag._id) {
                            LibraryTagKeys.forEach(key => {
                                if (editFormValues[key] !== undefined) {
                                    item[key] = editFormValues[key] || null;
                                }
                            });
                            if (editFormValues.number !== undefined) {
                                item.number = editFormValues.number || null;
                            }
                        }
                        return item;
                    });
                    await storage.writeFile(filePath, JSON.stringify(updatedData, null, 2));
                } else if (data._id === selectedTag._id) {
                    LibraryTagKeys.forEach(key => {
                        if (editFormValues[key] !== undefined) {
                            data[key] = editFormValues[key] || null;
                        }
                    });
                    if (editFormValues.number !== undefined) {
                        data.number = editFormValues.number || null;
                    }
                    await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                }
            }

            // Update local state
            setTags(updatedTags);
            setSelectedTag(updatedTag);
            LibraryStore.update(s => {
                s.tags = updatedTags;
            });

            onClose();
        } catch (err) {
            console.error("Failed to save tag edits:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedTag) return;
        setDeleting(true);
        try {
            // Remove the tag from tags array
            const updatedTags = tags.filter(t => t._id !== selectedTag._id);

            // Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            // Remove from the article file
            const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
            if (await storage.exists(filePath)) {
                const fileContent = await storage.readFile(filePath);
                const data = JSON.parse(fileContent);
                if (Array.isArray(data)) {
                    const updatedData = data.filter(item => item._id !== selectedTag._id);
                    if (updatedData.length > 0) {
                        await storage.writeFile(filePath, JSON.stringify(updatedData, null, 2));
                    } else {
                        // Delete the file if no items remain
                        await storage.deleteFile(filePath);
                    }
                } else if (data._id === selectedTag._id) {
                    // Delete the file if it only contained this article
                    await storage.deleteFile(filePath);
                }
            }

            // Update local state
            setTags(updatedTags);
            setSelectedTag(null);
            setContent(null);
            LibraryStore.update(s => {
                s.tags = updatedTags;
            });

            onClose();
        } catch (err) {
            console.error("Failed to delete article:", err);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleClose = () => {
        if (!saving && !deleting) {
            setShowDeleteConfirm(false);
            onClose();
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                TransitionProps={{
                    onEnter: initializeForm
                }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {translations.EDIT_TAGS}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                        {/* Article ID with copy button */}
                        <Box
                            onClick={copyIdToClipboard}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 1.5,
                                bgcolor: "action.hover",
                                borderRadius: 2,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                "&:hover": {
                                    bgcolor: "action.selected"
                                }
                            }}
                        >
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                                ID:
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontFamily: "monospace",
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {selectedTag?._id}
                            </Typography>
                            <Tooltip title={idCopied ? (translations.COPIED || "Copied!") : (translations.COPY || "Copy")}>
                                <ContentCopyIcon
                                    sx={{
                                        fontSize: 18,
                                        color: idCopied ? "success.main" : "text.secondary",
                                        transition: "color 0.2s"
                                    }}
                                />
                            </Tooltip>
                        </Box>
                        <TextField
                            label={translations.NUMBER}
                            value={editFormValues.number || ""}
                            onChange={handleEditChange("number")}
                            fullWidth
                            size="small"
                        />
                        {LibraryTagKeys.map(key => (
                            <TextField
                                key={key}
                                label={translations[key.toUpperCase()] || key.charAt(0).toUpperCase() + key.slice(1)}
                                value={editFormValues[key] || ""}
                                onChange={handleEditChange(key)}
                                fullWidth
                                size="small"
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0, justifyContent: "space-between" }}>
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={saving || deleting}
                    >
                        {translations.DELETE || "Delete"}
                    </Button>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button onClick={handleClose} disabled={saving || deleting}>
                            {translations.CANCEL || "Cancel"}
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            variant="contained"
                            disabled={saving || deleting}
                        >
                            {saving ? (translations.SAVING || "Saving...") : (translations.SAVE || "Save")}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={showDeleteConfirm}
                onClose={() => !deleting && setShowDeleteConfirm(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 700, color: "error.main" }}>
                    {translations.DELETE_ARTICLE || "Delete Article"}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {translations.DELETE_ARTICLE_CONFIRM || "Are you sure you want to delete this article? This action cannot be undone."}
                    </Typography>
                    {selectedTag && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {[selectedTag.article, selectedTag.title].filter(Boolean).join(" - ")}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                        {translations.CANCEL || "Cancel"}
                    </Button>
                    <Button
                        onClick={handleDelete}
                        variant="contained"
                        color="error"
                        disabled={deleting}
                    >
                        {deleting ? (translations.DELETING || "Deleting...") : (translations.DELETE || "Delete")}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
