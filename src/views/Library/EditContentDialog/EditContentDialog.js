import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import TextField from "@ui/TextField";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import clsx from "clsx";
import { useEffect, useState } from "react";
import dialog from "../../../css/dialog-patterns.module.css";
import styles from "./EditContentDialog.module.css";

export default function EditContentDialog({
	open,
	onClose,
	selectedTag,
	content,
	setContent,
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
				let changed = false;
				if (Array.isArray(data)) {
					const updatedData = data.map((item) => {
						if (item._id === selectedTag._id) {
							if (item.text !== editContent) {
								changed = true;
							}
							return { ...item, text: editContent };
						}
						return item;
					});
					if (changed) {
						await storage.writeFile(
							filePath,
							JSON.stringify(updatedData, null, 2),
						);
					}
				} else if (data._id === selectedTag._id && data.text !== editContent) {
					data.text = editContent;
					changed = true;
					await storage.writeFile(filePath, JSON.stringify(data, null, 2));
				}
				if (changed) {
					await bumpLibraryCounter();
				}
			}

			// Update local state
			setContent(editContent);
			onClose();
		} catch (err) {
			structuredLogger.error("Failed to save article content:", err);
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
			className={dialog.dialogTall}
		>
			<DialogTitle className={dialog.titleBold}>
				{translations.EDIT_ARTICLE || "Edit Article"}
			</DialogTitle>
			<DialogContent className={dialog.contentColumn}>
				<Box className={dialog.contentFlex}>
					<TextField
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						multiline
						fullWidth
						variant="outlined"
						className={clsx(styles.contentField, dialog.contentField)}
						inputClassName={dialog.contentTextarea}
						placeholder={
							translations.ARTICLE_CONTENT_PLACEHOLDER ||
							"Enter article content..."
						}
					/>
				</Box>
			</DialogContent>
			<DialogActions className={dialog.actionsPaddedTight}>
				<Button onClick={handleClose} disabled={saving}>
					{translations.CANCEL || "Cancel"}
				</Button>
				<Button onClick={handleSave} variant="contained" disabled={saving}>
					{saving
						? translations.SAVING || "Saving..."
						: translations.SAVE || "Save"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
