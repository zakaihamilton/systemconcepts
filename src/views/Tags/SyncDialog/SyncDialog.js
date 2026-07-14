import CloudSyncIcon from "@icons/CloudSync";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import Box from "@ui/Box";
import Button from "@ui/Button";
import CircularProgress from "@ui/CircularProgress";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import Divider from "@ui/Divider";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import { LibraryTagKeys } from "@views/Library/Icons";
import React, { useCallback, useEffect, useState } from "react";
import dialog from "../../../css/dialog-patterns.module.css";
import styles from "./SyncDialog.module.css";
export default function SyncDialog({ open, onClose, tags }) {
	const translations = useTranslations();
	const [processing, setProcessing] = useState(false);
	const [calculating, setCalculating] = useState(false);
	const [changes, setChanges] = useState([]);

	const calculateChanges = useCallback(async () => {
		setCalculating(true);
		try {
			const filesToUpdate = {};
			tags.forEach((tag) => {
				if (tag.path) {
					if (!filesToUpdate[tag.path]) {
						filesToUpdate[tag.path] = [];
					}
					filesToUpdate[tag.path].push(tag);
				}
			});

			const calculatedChanges = [];

			for (const [relativePath, fileTags] of Object.entries(filesToUpdate)) {
				const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
				if (await storage.exists(filePath)) {
					const content = await storage.readFile(filePath);
					const data = JSON.parse(content);
					const fileChanges = [];

					const compareItem = (item, tag) => {
						const itemDiffs = [];
						LibraryTagKeys.forEach((key) => {
							if (item[key] !== tag[key]) {
								itemDiffs.push({ key, old: item[key], new: tag[key] });
							}
						});
						if (item.number !== tag.number) {
							itemDiffs.push({
								key: "number",
								old: item.number,
								new: tag.number,
							});
						}
						if (item.subNumber !== tag.subNumber) {
							itemDiffs.push({
								key: "subNumber",
								old: item.subNumber,
								new: tag.subNumber,
							});
						}
						if (item.order !== tag.order) {
							itemDiffs.push({ key: "order", old: item.order, new: tag.order });
						}
						return itemDiffs;
					};

					if (Array.isArray(data)) {
						data.forEach((item) => {
							const tag = fileTags.find((t) => t._id === item._id);
							if (tag) {
								const diffs = compareItem(item, tag);
								if (diffs.length > 0) {
									fileChanges.push({
										id: item._id,
										name: item.name || item.hebrew || item.english,
										diffs,
									});
								}
							}
						});
					} else if (data._id) {
						const tag = fileTags.find((t) => t._id === data._id);
						if (tag) {
							const diffs = compareItem(data, tag);
							if (diffs.length > 0) {
								fileChanges.push({
									id: data._id,
									name: data.name || data.hebrew || data.english,
									diffs,
								});
							}
						}
					}

					if (fileChanges.length > 0) {
						calculatedChanges.push({
							path: relativePath,
							changes: fileChanges,
						});
					}
				}
			}
			setChanges(calculatedChanges);
		} catch (err) {
			structuredLogger.error("Failed to calculate changes:", err);
		} finally {
			setCalculating(false);
		}
	}, [tags]);

	useEffect(() => {
		if (open) {
			calculateChanges();
		} else {
			setChanges([]);
		}
	}, [open, calculateChanges]);

	const handleApplySync = async () => {
		setProcessing(true);
		try {
			const filesToUpdate = changes.map((c) => c.path);

			for (const relativePath of filesToUpdate) {
				const changeRecord = changes.find((c) => c.path === relativePath);
				if (!changeRecord) continue;

				const filePath = makePath(LIBRARY_LOCAL_PATH, relativePath);
				if (await storage.exists(filePath)) {
					const content = await storage.readFile(filePath);
					let data = JSON.parse(content);
					let changed = false;

					const updateItem = (item) => {
						const itemChange = changeRecord.changes.find(
							(c) => c.id === item._id,
						);
						if (itemChange) {
							itemChange.diffs.forEach((diff) => {
								item[diff.key] = diff.new;
							});
							return true;
						}
						return false;
					};

					if (Array.isArray(data)) {
						data = data.map((item) => {
							if (updateItem(item)) {
								changed = true;
							}
							return item;
						});
					} else if (data._id) {
						if (updateItem(data)) {
							changed = true;
						}
					}

					if (changed) {
						await storage.writeFile(filePath, JSON.stringify(data, null, 2));
					}
				}
			}
			if (changes.length > 0) {
				await bumpLibraryCounter();
			}

			onClose();
		} catch (err) {
			structuredLogger.error("Sync failed:", err);
		} finally {
			setProcessing(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={() => !processing && onClose()}
			maxWidth="md"
			fullWidth
		>
			<DialogTitle className={dialog.titleBold}>
				{translations.SYNC_ARTICLE_TAGS} -{" "}
				{translations.REVIEW_CHANGES || "Review Changes"}
			</DialogTitle>
			<DialogContent dividers>
				{calculating ? (
					<Box className={dialog.flexCenterP4}>
						<CircularProgress />
					</Box>
				) : changes.length === 0 ? (
					<Typography align="center" className={dialog.noChanges}>
						{translations.NO_CHANGES_DETECTED ||
							"No changes detected. Files are already in sync."}
					</Typography>
				) : (
					<List className={dialog.listFlush}>
						{changes.map((file, idx) => (
							<React.Fragment key={file.path}>
								<ListItem disablePadding className={dialog.listItemBlock}>
									<Typography variant="subtitle2" className={dialog.pathLabel}>
										{file.path}
									</Typography>
									<List disablePadding className={dialog.nestedList}>
										{file.changes.map((change) => (
											<ListItem
												key={change.id}
												className={styles.listItemBlock}
											>
												<Typography
													variant="body2"
													className={styles.changeName}
												>
													{change.name}
												</Typography>
												{change.diffs.map((diff, i) => (
													<Typography
														key={i}
														variant="caption"
														display="block"
														color="text.secondary"
														className={dialog.diffIndent}
													>
														{diff.key}: {JSON.stringify(diff.old)} &rarr;{" "}
														{JSON.stringify(diff.new)}
													</Typography>
												))}
											</ListItem>
										))}
									</List>
								</ListItem>
								{idx < changes.length - 1 && (
									<Divider className={dialog.dividerMy1} />
								)}
							</React.Fragment>
						))}
					</List>
				)}
			</DialogContent>
			<DialogActions className={dialog.actionsPadded}>
				<Button onClick={onClose} disabled={processing}>
					{translations.CANCEL || "Cancel"}
				</Button>
				<Button
					onClick={handleApplySync}
					variant="contained"
					disabled={processing || calculating || changes.length === 0}
					startIcon={<CloudSyncIcon />}
				>
					{processing
						? translations.SYNCING_ARTICLE_TAGS
						: translations.APPLY_CHANGES || "Apply Changes"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
