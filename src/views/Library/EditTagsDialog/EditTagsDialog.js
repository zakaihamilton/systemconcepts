import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import DeleteIcon from "@icons/svg/Delete.svg";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import Tooltip from "@widgets/Tooltip";
import { useEffect, useState } from "react";
import dialog from "../../../css/dialog-patterns.module.css";
import { LibraryTagKeys } from "../Icons";
import { LibraryStore } from "../Store";
import styles from "./EditTagsDialog.module.css";
export default function EditTagsDialog({
	open,
	onClose,
	selectedTag,
	tags,
	setTags,
	setSelectedTag,
	setContent,
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
			LibraryTagKeys.forEach((key) => {
				formValues[key] = selectedTag[key] || "";
			});
			formValues.number = selectedTag.number || "";
			formValues.subNumber = selectedTag.subNumber || "";
			formValues.order = selectedTag.order || "";
			setEditFormValues(formValues);
			setIdCopied(false);
			setShowDeleteConfirm(false);
		}
	};

	useEffect(() => {
		if (open) {
			initializeForm();
		}
	}, [open, selectedTag]);

	const copyIdToClipboard = async () => {
		if (selectedTag?._id) {
			try {
				await navigator.clipboard.writeText(selectedTag._id);
				setIdCopied(true);
				setTimeout(() => setIdCopied(false), 2000);
			} catch (err) {
				structuredLogger.error("Failed to copy ID:", err);
			}
		}
	};

	const handleEditChange = (key) => (event) => {
		setEditFormValues((prev) => ({
			...prev,
			[key]: event.target.value,
		}));
	};

	const handleSaveEdit = async () => {
		if (!selectedTag) return;
		setSaving(true);
		try {
			// Update the tag in the tags array
			const updatedTag = { ...selectedTag };
			LibraryTagKeys.forEach((key) => {
				if (editFormValues[key] !== undefined) {
					updatedTag[key] = editFormValues[key] || null;
				}
			});
			if (editFormValues.number !== undefined) {
				updatedTag.number = editFormValues.number || null;
			}
			if (editFormValues.subNumber !== undefined) {
				updatedTag.subNumber = editFormValues.subNumber || null;
			}
			if (editFormValues.order !== undefined) {
				updatedTag.order = editFormValues.order || null;
			}

			// Update tags.json
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			const updatedTags = tags.map((t) =>
				t._id === selectedTag._id ? updatedTag : t,
			);
			await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

			// Update the article file
			const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
			if (await storage.exists(filePath)) {
				const fileContent = await storage.readFile(filePath);
				const data = JSON.parse(fileContent);
				if (Array.isArray(data)) {
					const updatedData = data.map((item) => {
						if (item._id === selectedTag._id) {
							LibraryTagKeys.forEach((key) => {
								if (editFormValues[key] !== undefined) {
									item[key] = editFormValues[key] || null;
								}
							});
							if (editFormValues.number !== undefined) {
								item.number = editFormValues.number || null;
							}
							if (editFormValues.subNumber !== undefined) {
								item.subNumber = editFormValues.subNumber || null;
							}
							if (editFormValues.order !== undefined) {
								item.order = editFormValues.order || null;
							}
						}
						return item;
					});
					await storage.writeFile(
						filePath,
						JSON.stringify(updatedData, null, 2),
					);
				} else if (data._id === selectedTag._id) {
					LibraryTagKeys.forEach((key) => {
						if (editFormValues[key] !== undefined) {
							data[key] = editFormValues[key] || null;
						}
					});
					if (editFormValues.number !== undefined) {
						data.number = editFormValues.number || null;
					}
					if (editFormValues.subNumber !== undefined) {
						data.subNumber = editFormValues.subNumber || null;
					}
					if (editFormValues.order !== undefined) {
						data.order = editFormValues.order || null;
					}
					await storage.writeFile(filePath, JSON.stringify(data, null, 2));
				}
			}

			// Update local state
			setTags(updatedTags);
			setSelectedTag(updatedTag);
			LibraryStore.update((s) => {
				s.tags = updatedTags;
			});
			await bumpLibraryCounter();

			onClose();
		} catch (err) {
			structuredLogger.error("Failed to save tag edits:", err);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedTag) return;
		setDeleting(true);
		try {
			// Remove the tag from tags array
			const updatedTags = tags.filter((t) => t._id !== selectedTag._id);

			// Update tags.json
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			await storage.writeFile(tagsPath, JSON.stringify(updatedTags, null, 2));

			// Remove from the article file
			const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
			if (await storage.exists(filePath)) {
				const fileContent = await storage.readFile(filePath);
				const data = JSON.parse(fileContent);
				if (Array.isArray(data)) {
					const updatedData = data.filter(
						(item) => item._id !== selectedTag._id,
					);
					if (updatedData.length > 0) {
						await storage.writeFile(
							filePath,
							JSON.stringify(updatedData, null, 2),
						);
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
			LibraryStore.update((s) => {
				s.tags = updatedTags;
			});
			await bumpLibraryCounter();

			onClose();
		} catch (err) {
			structuredLogger.error("Failed to delete article:", err);
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
			<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
				<DialogTitle className={dialog.titleBold}>
					{translations.EDIT_TAGS}
				</DialogTitle>
				<DialogContent>
					<Box className={dialog.flexColumnGap2}>
						{/* Article ID with copy button */}
						<Box className={styles.idRow} onClick={copyIdToClipboard}>
							<Typography variant="caption" className={styles.idLabel}>
								ID:
							</Typography>
							<Typography variant="body2" className={styles.idValue}>
								{selectedTag?._id}
							</Typography>
							<Tooltip
								title={
									idCopied
										? translations.COPIED || "Copied!"
										: translations.COPY || "Copy"
								}
							>
								<ContentCopyIcon
									className={idCopied ? styles.copyIconCopied : styles.copyIcon}
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
						<TextField
							label={translations.SUB_NUMBER || "Sub-Number"}
							value={editFormValues.subNumber || ""}
							onChange={handleEditChange("subNumber")}
							fullWidth
							size="small"
							type="number"
							helperText={
								translations.SUB_NUMBER_HELPER ||
								"For articles with same number"
							}
						/>
						<TextField
							label={translations.ORDER || "Order"}
							value={editFormValues.order || ""}
							onChange={handleEditChange("order")}
							fullWidth
							size="small"
							type="number"
							helperText={
								translations.ORDER_HELPER || "Lower numbers appear first"
							}
						/>
						{LibraryTagKeys.map((key) => (
							<TextField
								key={key}
								label={
									translations[key.toUpperCase()] ||
									key.charAt(0).toUpperCase() + key.slice(1)
								}
								value={editFormValues[key] || ""}
								onChange={handleEditChange(key)}
								fullWidth
								size="small"
							/>
						))}
					</Box>
				</DialogContent>
				<DialogActions className={dialog.actionsSpaced}>
					<Button
						onClick={() => setShowDeleteConfirm(true)}
						color="error"
						startIcon={<DeleteIcon />}
						disabled={saving || deleting}
					>
						{translations.DELETE || "Delete"}
					</Button>
					<Box className={dialog.flexRowGap1}>
						<Button onClick={handleClose} disabled={saving || deleting}>
							{translations.CANCEL || "Cancel"}
						</Button>
						<Button
							onClick={handleSaveEdit}
							variant="contained"
							disabled={saving || deleting}
						>
							{saving
								? translations.SAVING || "Saving..."
								: translations.SAVE || "Save"}
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
				<DialogTitle className={dialog.titleError}>
					{translations.DELETE_ARTICLE || "Delete Article"}
				</DialogTitle>
				<DialogContent>
					<Typography>
						{translations.DELETE_ARTICLE_CONFIRM ||
							"Are you sure you want to delete this article? This action cannot be undone."}
					</Typography>
					{selectedTag && (
						<Box className={dialog.highlightBoxSm}>
							<Typography variant="body2" className={styles.confirmName}>
								{[selectedTag.article, selectedTag.title]
									.filter(Boolean)
									.join(" - ")}
							</Typography>
						</Box>
					)}
				</DialogContent>
				<DialogActions className={dialog.actionsPaddedTight}>
					<Button
						onClick={() => setShowDeleteConfirm(false)}
						disabled={deleting}
					>
						{translations.CANCEL || "Cancel"}
					</Button>
					<Button
						onClick={handleDelete}
						variant="contained"
						color="error"
						disabled={deleting}
					>
						{deleting
							? translations.DELETING || "Deleting..."
							: translations.DELETE || "Delete"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
