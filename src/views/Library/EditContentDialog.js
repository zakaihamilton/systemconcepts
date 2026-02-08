import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";

export default function EditContentDialog({
    open,
    onClose,
    selectedTag,
    content,
    setContent
}) {
    const translations = useTranslations();
    const [editContent, setEditContent] = useState("");
    const [saving, setSaving] = useState(false);

    // Initialize content when dialog opens
    useEffect(() => {
        if (open && content) {
            setEditContent(content);
        }
    }, [open, content]);

    const handleSave = async () => {
        if (!selectedTag) return;
        setSaving(true);
        try {
            // Update the article file
            const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
            if (await storage.exists(filePath)) {
                const fileContent = await storage.readFile(filePath);
                const data = JSON.parse(fileContent);
                if (Array.isArray(data)) {
                    const updatedData = data.map(item => {
                        if (item._id === selectedTag._id) {
                            return { ...item, text: editContent };
                        }
                        return item;
                    });
                    await storage.writeFile(filePath, JSON.stringify(updatedData, null, 2));
                } else if (data._id === selectedTag._id) {
                    data.text = editContent;
                    await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                }
            }

            // Update local state
            setContent(editContent);
            onClose();
        } catch (err) {
            console.error("Failed to save article content:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    height: "80vh",
                    maxHeight: "80vh"
                }
            }}
        >
            <DialogTitle sx={{ fontWeight: 700 }}>
                {translations.EDIT_ARTICLE || "Edit Article"}
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", p: 0 }}>
                <Box sx={{ flex: 1, p: 2, pt: 1, display: "flex", flexDirection: "column" }}>
                    <TextField
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        multiline
                        fullWidth
                        variant="outlined"
                        placeholder={translations.ARTICLE_CONTENT_PLACEHOLDER || "Enter article content..."}
                        sx={{
                            flex: 1,
                            "& .MuiInputBase-root": {
                                flex: 1,
                                alignItems: "flex-start",
                                fontFamily: "inherit",
                                fontSize: "0.95rem",
                                lineHeight: 1.6
                            },
                            "& .MuiInputBase-input": {
                                height: "100% !important",
                                overflow: "auto !important"
                            }
                        }}
                        InputProps={{
                            sx: {
                                height: "100%"
                            }
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={handleClose} disabled={saving}>
                    {translations.CANCEL || "Cancel"}
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving}
                >
                    {saving ? (translations.SAVING || "Saving...") : (translations.SAVE || "Save")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
