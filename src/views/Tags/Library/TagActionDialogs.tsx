import DeleteIcon from "@icons/svg/Delete.svg";
import DeleteForeverIcon from "@icons/svg/DeleteForever.svg";
import EditIcon from "@icons/svg/Edit.svg";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import ListItemIcon from "@ui/ListItemIcon";
import ListItemText from "@ui/ListItemText";
import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import dialog from "../../../css/dialog-patterns.module.css";
import styles from "./Library.module.css";

interface TagActionDialogsProps {
	translations: any;
	processing: boolean;
	menuPosition: { top: number; left: number } | null;
	actionItem: any;
	onMenuClose: (event?: any) => void;
	renameDialog: any;
	setRenameDialog: (value: any) => void;
	newValue: string;
	setNewValue: (value: string) => void;
	onRename: () => void;
	deleteDialog: any;
	setDeleteDialog: (value: any) => void;
	onDelete: () => void;
	deleteArticlesDialog: any;
	setDeleteArticlesDialog: (value: any) => void;
	onDeleteArticles: () => void;
}

/**
 * Renders the row action menu and rename/delete confirmation dialogs for LibraryTags.
 */
export default function TagActionDialogs({
	translations,
	processing,
	menuPosition,
	actionItem,
	onMenuClose,
	renameDialog,
	setRenameDialog,
	newValue,
	setNewValue,
	onRename,
	deleteDialog,
	setDeleteDialog,
	onDelete,
	deleteArticlesDialog,
	setDeleteArticlesDialog,
	onDeleteArticles,
}: TagActionDialogsProps) {
	return (
		<>
			<Menu
				open={!!menuPosition}
				onClose={onMenuClose}
				anchorReference="anchorPosition"
				anchorPosition={menuPosition}
			>
				<MenuItem
					onClick={() => {
						setNewValue(actionItem.value);
						setRenameDialog(actionItem);
						onMenuClose();
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
						onMenuClose();
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
						onMenuClose();
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
							onChange={(e: any) => setNewValue(e.target.value)}
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
						onClick={onRename}
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
						onClick={onDelete}
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
						onClick={onDeleteArticles}
						variant="contained"
						color="error"
						disabled={processing}
					>
						{processing ? translations.DELETING : translations.DELETE_FOREVER}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
