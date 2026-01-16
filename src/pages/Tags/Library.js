import React, { useEffect, useState, useMemo } from 'react';
import Cookies from "js-cookie";
import { roleAuth } from "@util/roles";
import { Store } from "pullstate";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import { LibraryTagKeys } from "@pages/Library/Icons";
import Table from "@widgets/Table";
import styles from "../Tags.module.scss";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { LibraryStore } from "@pages/Library/Store";
import SyncDialog from "./SyncDialog";
import { registerToolbar, useToolbar } from "@components/Toolbar";

registerToolbar("LibraryTags", 110);

export const LibraryTagsStore = new Store({
    order: "asc",
    offset: 0,
    orderBy: "count",
    viewMode: "list",
    search: ""
});

export default function LibraryTags() {
    const translations = useTranslations();
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const { order, orderBy } = LibraryTagsStore.useState();

    // Dialog States
    const [renameDialog, setRenameDialog] = useState(null); // { category, value }
    const [deleteDialog, setDeleteDialog] = useState(null); // { category, value, count }
    const [syncDialog, setSyncDialog] = useState(false);
    const [newValue, setNewValue] = useState("");
    const [processing, setProcessing] = useState(false);

    const role = Cookies.get("role");
    const isAdmin = roleAuth(role, "admin");

    useEffect(() => {
        loadTags();
    }, []);

    const toolbarItems = [
        isAdmin && {
            id: "sync",
            name: translations.SYNC_ARTICLE_TAGS,
            icon: <CloudSyncIcon />,
            onClick: () => setSyncDialog(true),
            location: "header"
        }
    ].filter(Boolean);

    useToolbar({ id: "LibraryTags", items: toolbarItems, depends: [isAdmin, translations] });

    const loadTags = async () => {
        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (await storage.exists(tagsPath)) {
                const content = await storage.readFile(tagsPath);
                const data = JSON.parse(content);
                setTags(data);
            }
        } catch (err) {
            console.error("Failed to load tags:", err);
        }
    };

    const aggregatedData = useMemo(() => {
        const map = new Map();

        tags.forEach(tag => {
            LibraryTagKeys.forEach(key => {
                const value = tag[key];
                if (value && typeof value === 'string') {
                    const id = `${key}|${value}`;
                    if (!map.has(id)) {
                        map.set(id, {
                            id,
                            category: key,
                            value,
                            count: 0
                        });
                    }
                    map.get(id).count++;
                }
            });
        });

        return Array.from(map.values());
    }, [tags]);

    const sortedData = useMemo(() => {
        return aggregatedData.sort((a, b) => {
            const aValue = a[orderBy];
            const bValue = b[orderBy];
            if (aValue < bValue) {
                return order === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return order === "asc" ? 1 : -1;
            }
            return 0;
        });
    }, [aggregatedData, order, orderBy]);

    const handleRename = async () => {
        if (!renameDialog || !newValue || newValue === renameDialog.value) {
            setRenameDialog(null);
            return;
        }

        setProcessing(true);
        try {
            const { category, value: oldValue } = renameDialog;

            // 1. Update tags array
            const updatedTags = tags.map(tag => {
                if (tag[category] === oldValue) {
                    return { ...tag, [category]: newValue };
                }
                return tag;
            });

            // 2. Identify files to update
            const affectedTags = tags.filter(tag => tag[category] === oldValue);

            // 3. Update files
            // Group by path to minimize file reads
            const filesToUpdate = {};
            affectedTags.forEach(tag => {
                if (tag.path) {
                    if (!filesToUpdate[tag.path]) {
                        filesToUpdate[tag.path] = [];
                    }
                    filesToUpdate[tag.path].push(tag._id);
                }
            });

            for (const [relativePath, ids] of Object.entries(filesToUpdate)) {
                const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
                if (await storage.exists(filePath)) {
                    const content = await storage.readFile(filePath);
                    let data = JSON.parse(content);
                    let changed = false;

                    if (Array.isArray(data)) {
                        data = data.map(item => {
                            if (ids.includes(item._id)) {
                                item[category] = newValue;
                                changed = true;
                            }
                            return item;
                        });
                    } else if (data._id && ids.includes(data._id)) {
                        data[category] = newValue;
                        changed = true;
                    }

                    if (changed) {
                        await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                    }
                }
            }

            // 4. Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            // 5. Update state
            setTags(updatedTags);
            LibraryStore.update(s => { s.tags = updatedTags; });

        } catch (err) {
            console.error("Rename failed:", err);
        } finally {
            setProcessing(false);
            setRenameDialog(null);
            setNewValue("");
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog) return;

        setProcessing(true);
        try {
            const { category, value: oldValue } = deleteDialog;

            // 1. Update tags array (remove key or set to null?)
            // Usually we remove the field or set to null.
            // In tags.json context, fields are optional.
            const updatedTags = tags.map(tag => {
                if (tag[category] === oldValue) {
                    const newTag = { ...tag };
                    delete newTag[category];
                    return newTag;
                }
                return tag;
            });

            // 2. Identify files to update
            const affectedTags = tags.filter(tag => tag[category] === oldValue);
            const filesToUpdate = {};
            affectedTags.forEach(tag => {
                if (tag.path) {
                    if (!filesToUpdate[tag.path]) {
                        filesToUpdate[tag.path] = [];
                    }
                    filesToUpdate[tag.path].push(tag._id);
                }
            });

            for (const [relativePath, ids] of Object.entries(filesToUpdate)) {
                const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
                if (await storage.exists(filePath)) {
                    const content = await storage.readFile(filePath);
                    let data = JSON.parse(content);
                    let changed = false;

                    if (Array.isArray(data)) {
                        data = data.map(item => {
                            if (ids.includes(item._id)) {
                                delete item[category];
                                changed = true;
                            }
                            return item;
                        });
                    } else if (data._id && ids.includes(data._id)) {
                        delete data[category];
                        changed = true;
                    }

                    if (changed) {
                        await storage.writeFile(filePath, JSON.stringify(data, null, 2));
                    }
                }
            }

            // 3. Update tags.json
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

            // 4. Update state
            setTags(updatedTags);
            LibraryStore.update(s => { s.tags = updatedTags; });

        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setProcessing(false);
            setDeleteDialog(null);
        }
    };

    const columns = [
        {
            id: "category",
            title: translations.CATEGORY || "Category",
            sortable: true,
            columnProps: { style: { width: "150px", textTransform: "capitalize" } }
        },
        {
            id: "value",
            title: translations.VALUE || "Value",
            sortable: true,
            columnProps: { style: { flex: 1 } }
        },
        {
            id: "count",
            title: translations.COUNT || "Count",
            sortable: true,
            columnProps: { style: { width: "100px" } }
        },
        {
            id: "actions",
            title: "",
            sortable: false,
            columnProps: { style: { width: "120px", textAlign: "right" } }
        }
    ];

    const tableData = useMemo(() => {
        return sortedData.map(item => ({
            ...item,
            actions: (
                isAdmin && <Box>
                    <Tooltip title={translations.RENAME || "Rename"}>
                        <IconButton
                            size="small"
                            onClick={() => {
                                setNewValue(item.value);
                                setRenameDialog(item);
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={translations.DELETE || "Delete"}>
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog(item)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }));
    }, [sortedData, translations]);

    return (
        <div className={styles.root}>
            <Table
                name="library_tags"
                store={LibraryTagsStore}
                columns={columns}
                data={tableData}
                viewModes={{
                    list: {
                        className: styles.libraryList
                    },
                    table: null
                }}
            />

            {/* Rename Dialog */}
            <Dialog open={!!renameDialog} onClose={() => !processing && setRenameDialog(null)}>
                <DialogTitle>{translations.RENAME_TAG || "Rename Tag"}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, minWidth: 300 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {renameDialog?.category && (translations[renameDialog.category.toUpperCase()] || renameDialog.category)}
                        </Typography>
                        <TextField
                            autoFocus
                            fullWidth
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            label={translations.VALUE || "Value"}
                            disabled={processing}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialog(null)} disabled={processing}>
                        {translations.CANCEL || "Cancel"}
                    </Button>
                    <Button onClick={handleRename} variant="contained" disabled={processing || !newValue.trim()}>
                        {processing ? (translations.SAVING || "Saving...") : (translations.SAVE || "Save")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deleteDialog} onClose={() => !processing && setDeleteDialog(null)}>
                <DialogTitle>{translations.DELETE_TAG || "Delete Tag"}</DialogTitle>
                <DialogContent>
                    <Typography>
                        {translations.DELETE_TAG_CONFIRM || "Are you sure you want to remove this tag from all articles?"}
                    </Typography>
                    {deleteDialog && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                {deleteDialog.category}:
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                                {deleteDialog.value}
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                {translations.AFFECTED_ITEMS || "Affected items"}: {deleteDialog.count}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog(null)} disabled={processing}>
                        {translations.CANCEL || "Cancel"}
                    </Button>
                    <Button onClick={handleDelete} variant="contained" color="error" disabled={processing}>
                        {processing ? (translations.DELETING || "Deleting...") : (translations.DELETE || "Delete")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Sync Confirmation Dialog */}
            <SyncDialog
                open={syncDialog}
                onClose={() => setSyncDialog(false)}
                tags={tags}
            />
        </div>
    );
}
