import { registerToolbar, useToolbar } from "@components/Toolbar";
import CloudSyncIcon from "@icons/svg/CloudSync.svg";
import DeleteIcon from "@icons/svg/Delete.svg";
import DeleteForeverIcon from "@icons/svg/DeleteForever.svg";
import EditIcon from "@icons/svg/Edit.svg";
import EditAttributesIcon from "@icons/svg/EditAttributes.svg";
import MoreVertIcon from "@icons/svg/MoreVert.svg";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import IconButton from "@ui/IconButton";
import ListItemIcon from "@ui/ListItemIcon";
import ListItemText from "@ui/ListItemText";
import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import { LibraryTagKeys } from "@views/Library/Icons";
import { LibraryStore } from "@views/Library/Store";
import Table from "@widgets/Table";
import Cookies from "js-cookie";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo, useState } from "react";
import dialog from "../../../css/dialog-patterns.module.css";
import BatchDialog from "../BatchDialog";
import SyncDialog from "../SyncDialog";
import styles from "./Library.module.css";

registerToolbar("LibraryTags", 110);

export const LibraryTagsStore = new Store({
	order: "asc",
	offset: 0,
	orderBy: "count",
	viewMode: "list",
	search: "",
});

export default function LibraryTags() {
	const translations = useTranslations();
	const [tags, setTags] = useState([]);
	const { order, orderBy } = LibraryTagsStore.useState();

	// Dialog States
	const [renameDialog, setRenameDialog] = useState(null); // { category, value }
	const [deleteDialog, setDeleteDialog] = useState(null); // { category, value, count }
	const [deleteArticlesDialog, setDeleteArticlesDialog] = useState(null); // { category, value, count }
	const [syncDialog, setSyncDialog] = useState(false);
	const [batchDialog, setBatchDialog] = useState(false);
	const [newValue, setNewValue] = useState("");
	const [processing, setProcessing] = useState(false);

	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	useEffect(() => {
		loadTags();
	}, []);

	const toolbarItems = [
		isAdmin && {
			id: "sync_article_tags",
			name: translations.SYNC_ARTICLE_TAGS,
			icon: <CloudSyncIcon />,
			onClick: () => setSyncDialog(true),
			location: "header",
		},
		isAdmin && {
			id: "batch",
			name: translations.BATCH_UPDATE_TAGS,
			icon: <EditAttributesIcon />,
			onClick: () => setBatchDialog(true),
			location: "header",
		},
	].filter(Boolean);

	useToolbar({
		id: "LibraryTags",
		items: toolbarItems,
		depends: [isAdmin, translations],
	});

	const loadTags = async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const content = await storage.readFile(tagsPath);
				const data = JSON.parse(content);
				setTags(data);
			}
		} catch (err) {
			structuredLogger.error("Failed to load tags:", err);
		}
	};

	const aggregatedData = useMemo(() => {
		const map = new Map();

		tags.forEach((tag) => {
			LibraryTagKeys.forEach((key) => {
				const value = tag[key];
				if (value && typeof value === "string") {
					const id = `${key}|${value}`;
					if (!map.has(id)) {
						map.set(id, {
							id,
							category: key,
							value,
							count: 0,
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
			const updatedTags = tags.map((tag) => {
				if (tag[category] === oldValue) {
					return { ...tag, [category]: newValue };
				}
				return tag;
			});

			// 2. Identify files to update
			const affectedTags = tags.filter((tag) => tag[category] === oldValue);

			// 3. Update files
			// Group by path to minimize file reads
			const filesToUpdate = {};
			affectedTags.forEach((tag) => {
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
						data = data.map((item) => {
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
			LibraryStore.update((s) => {
				s.tags = updatedTags;
			});
			await bumpLibraryCounter();
		} catch (err) {
			structuredLogger.error("Rename failed:", err);
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
			const updatedTags = tags.map((tag) => {
				if (tag[category] === oldValue) {
					const newTag = { ...tag };
					delete newTag[category];
					return newTag;
				}
				return tag;
			});

			// 2. Identify files to update
			const affectedTags = tags.filter((tag) => tag[category] === oldValue);
			const filesToUpdate = {};
			affectedTags.forEach((tag) => {
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
						data = data.map((item) => {
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
			LibraryStore.update((s) => {
				s.tags = updatedTags;
			});
			await bumpLibraryCounter();
		} catch (err) {
			structuredLogger.error("Delete failed:", err);
		} finally {
			setProcessing(false);
			setDeleteDialog(null);
		}
	};

	const handleDeleteArticles = async () => {
		if (!deleteArticlesDialog) return;

		setProcessing(true);
		try {
			const { category, value: filterValue } = deleteArticlesDialog;

			// 1. Identify articles to delete
			const articlesToDelete = tags.filter(
				(tag) => tag[category] === filterValue,
			);
			const idsToDelete = articlesToDelete.map((tag) => tag._id);

			// 2. Update tags array - remove these articles entirely
			const updatedTags = tags.filter((tag) => !idsToDelete.includes(tag._id));

			// 3. Group by file path to handle file operations
			const filesToUpdate = {};
			articlesToDelete.forEach((tag) => {
				if (tag.path) {
					if (!filesToUpdate[tag.path]) {
						filesToUpdate[tag.path] = [];
					}
					filesToUpdate[tag.path].push(tag._id);
				}
			});

			// 4. Update files
			for (const [relativePath, ids] of Object.entries(filesToUpdate)) {
				const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
				if (await storage.exists(filePath)) {
					const content = await storage.readFile(filePath);
					let data = JSON.parse(content);
					let shouldWrite = false;
					let shouldDelete = false;

					if (Array.isArray(data)) {
						const newData = data.filter((item) => !ids.includes(item._id));
						if (newData.length === 0) {
							shouldDelete = true;
						} else if (newData.length !== data.length) {
							data = newData;
							shouldWrite = true;
						}
					} else if (data._id && ids.includes(data._id)) {
						shouldDelete = true;
					}

					if (shouldDelete) {
						await storage.deleteFile(filePath);
					} else if (shouldWrite) {
						await storage.writeFile(filePath, JSON.stringify(data, null, 2));
					}
				}
			}

			// 5. Update tags.json
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

			// 6. Update state
			setTags(updatedTags);
			LibraryStore.update((s) => {
				s.tags = updatedTags;
			});
			await bumpLibraryCounter();
		} catch (err) {
			structuredLogger.error("Delete articles failed:", err);
		} finally {
			setProcessing(false);
			setDeleteArticlesDialog(null);
		}
	};

	const columns = [
		{
			id: "category",
			title: translations.CATEGORY,
			sortable: true,
			columnProps: { style: { width: "150px", textTransform: "capitalize" } },
		},
		{
			id: "value",
			title: translations.VALUE,
			sortable: true,
			columnProps: { style: { flex: 1 } },
		},
		{
			id: "count",
			title: translations.COUNT,
			sortable: true,
			columnProps: { style: { width: "100px" } },
		},
		{
			id: "actions",
			title: "",
			sortable: false,
			columnProps: { style: { width: "60px", textAlign: "right" } },
		},
	];

	const [actionItem, setActionItem] = useState(null);
	const [menuPosition, setMenuPosition] = useState(null);

	const handleActionMenuOpen = useCallback((event, item) => {
		event.stopPropagation();
		setMenuPosition({
			top: event.clientY,
			left: event.clientX,
		});
		setActionItem(item);
	}, []);

	const handleActionMenuClose = useCallback((event) => {
		if (event && event.stopPropagation) {
			event.stopPropagation();
		}
		setMenuPosition(null);
		setActionItem(null);
	}, []);

	const tableData = useMemo(() => {
		return sortedData.map((item) => ({
			...item,
			actions: isAdmin && (
				<IconButton size="small" onClick={(e) => handleActionMenuOpen(e, item)}>
					<MoreVertIcon fontSize="small" />
				</IconButton>
			),
		}));
	}, [sortedData, isAdmin, handleActionMenuOpen]);

	return (
		<div className={styles.root}>
			<Table
				name="library_tags"
				store={LibraryTagsStore}
				columns={columns}
				data={tableData}
				viewModes={{
					list: {
						className: styles.libraryList,
					},
					table: null,
				}}
			/>

			<Menu
				open={!!menuPosition}
				onClose={handleActionMenuClose}
				anchorReference="anchorPosition"
				anchorPosition={menuPosition}
			>
				<MenuItem
					onClick={() => {
						setNewValue(actionItem.value);
						setRenameDialog(actionItem);
						handleActionMenuClose();
					}}
				>
					<ListItemIcon>
						<EditIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>{translations.RENAME}</ListItemText>
				</MenuItem>
				<MenuItem
					onClick={() => {
						setDeleteDialog(actionItem);
						handleActionMenuClose();
					}}
				>
					<ListItemIcon>
						<DeleteIcon fontSize="small" color="warning" />
					</ListItemIcon>
					<ListItemText>{translations.DELETE_TAG}</ListItemText>
				</MenuItem>
				<MenuItem
					onClick={() => {
						setDeleteArticlesDialog(actionItem);
						handleActionMenuClose();
					}}
				>
					<ListItemIcon>
						<DeleteForeverIcon fontSize="small" color="error" />
					</ListItemIcon>
					<ListItemText>{translations.DELETE_ARTICLES}</ListItemText>
				</MenuItem>
			</Menu>

			{/* Rename Dialog */}
			<Dialog
				open={!!renameDialog}
				onClose={() => !processing && setRenameDialog(null)}
			>
				<DialogTitle>{translations.RENAME_TAG}</DialogTitle>
				<DialogContent>
					<Box className={dialog.renameContent}>
						<Typography
							variant="caption"
							color="text.secondary"
							display="block"
							gutterBottom
						>
							{renameDialog?.category &&
								(translations[renameDialog.category.toUpperCase()] ||
									renameDialog.category)}
						</Typography>
						<TextField
							autoFocus
							fullWidth
							value={newValue}
							onChange={(e) => setNewValue(e.target.value)}
							label={translations.VALUE}
							disabled={processing}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setRenameDialog(null)} disabled={processing}>
						{translations.CANCEL}
					</Button>
					<Button
						onClick={handleRename}
						variant="contained"
						disabled={processing || !newValue.trim()}
					>
						{processing ? translations.SAVING : translations.SAVE}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Delete Dialog */}
			<Dialog
				open={!!deleteDialog}
				onClose={() => !processing && setDeleteDialog(null)}
			>
				<DialogTitle>{translations.DELETE_TAG}</DialogTitle>
				<DialogContent>
					<Typography>{translations.DELETE_TAG_CONFIRM}</Typography>
					{deleteDialog && (
						<Box className={dialog.highlightBoxSm}>
							<Typography variant="body2" color="text.secondary">
								{deleteDialog.category}:
							</Typography>
							<Typography variant="body1" fontWeight="bold">
								{deleteDialog.value}
							</Typography>
							<Typography
								variant="caption"
								display="block"
								className={styles.affectedCaption}
							>
								{translations.AFFECTED_ITEMS}: {deleteDialog.count}
							</Typography>
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDeleteDialog(null)} disabled={processing}>
						{translations.CANCEL}
					</Button>
					<Button
						onClick={handleDelete}
						variant="contained"
						color="error"
						disabled={processing}
					>
						{processing ? translations.DELETING : translations.DELETE}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Delete Articles Dialog */}
			<Dialog
				open={!!deleteArticlesDialog}
				onClose={() => !processing && setDeleteArticlesDialog(null)}
			>
				<DialogTitle className={dialog.titleErrorColor}>
					{translations.DELETE_ARTICLES}
				</DialogTitle>
				<DialogContent>
					<Typography>{translations.DELETE_ARTICLES_CONFIRM}</Typography>
					{deleteArticlesDialog && (
						<Box className={styles.deleteArticlesHighlight}>
							<Typography variant="body2" className={styles.errorBoxText}>
								{deleteArticlesDialog.category}:
							</Typography>
							<Typography variant="body1" fontWeight="bold">
								{deleteArticlesDialog.value}
							</Typography>
							<Typography
								variant="caption"
								display="block"
								className={styles.deleteArticlesCaption}
							>
								{translations.ARTICLES_TO_DELETE}: {deleteArticlesDialog.count}
							</Typography>
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setDeleteArticlesDialog(null)}
						disabled={processing}
					>
						{translations.CANCEL}
					</Button>
					<Button
						onClick={handleDeleteArticles}
						variant="contained"
						color="error"
						disabled={processing}
					>
						{processing ? translations.DELETING : translations.DELETE_FOREVER}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Sync Confirmation Dialog */}
			<SyncDialog
				open={syncDialog}
				onClose={() => setSyncDialog(false)}
				tags={tags}
			/>

			{/* Batch Update Dialog */}
			<BatchDialog
				open={batchDialog}
				onClose={() => setBatchDialog(false)}
				tags={tags}
				loadTags={loadTags}
			/>
		</div>
	);
}
