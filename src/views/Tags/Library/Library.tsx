import { registerToolbar, useToolbar } from "@components/Toolbar";
import CloudSyncIcon from "@icons/svg/CloudSync.svg";
import EditAttributesIcon from "@icons/svg/EditAttributes.svg";
import MoreVertIcon from "@icons/svg/MoreVert.svg";
import RefreshIcon from "@icons/svg/Refresh.svg";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import IconButton from "@ui/IconButton";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { createStore } from "@util/browser/store";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import { LibraryTagKeys } from "@views/Library/Icons";
import { LibraryStore } from "@views/Library/Store";
import Table from "@widgets/Table";
import Cookies from "js-cookie";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchDialog from "../BatchDialog";
import RebuildDialog from "../RebuildDialog/RebuildDialog";
import SyncDialog from "../SyncDialog";
import styles from "./Library.module.css";
import TagActionDialogs from "./TagActionDialogs";
import {
	deleteLibraryTag,
	deleteLibraryTagArticles,
	renameLibraryTag,
} from "./tagMutations";

registerToolbar("LibraryTags", 110);

const LibraryTagsStore = createStore({
	order: "asc",
	offset: 0,
	orderBy: "count",
	viewMode: "list",
	search: "",
});

export default function LibraryTags() {
	const translations = useTranslations();
	const [tags, setTags] = useState<any[]>([]);
	const { order, orderBy } = LibraryTagsStore.useState();

	// Dialog States
	const [renameDialog, setRenameDialog] = useState<any>(null); // { category, value }
	const [deleteDialog, setDeleteDialog] = useState<any>(null); // { category, value, count }
	const [deleteArticlesDialog, setDeleteArticlesDialog] = useState<any>(null); // { category, value, count }
	const [syncDialog, setSyncDialog] = useState(false);
	const [rebuildDialog, setRebuildDialog] = useState(false);
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
			id: "rebuild_library_tags",
			name: translations.REBUILD_LIBRARY_TAGS || "Rebuild Library Tags",
			icon: <RefreshIcon />,
			onClick: () => setRebuildDialog(true),
			location: "header",
		},
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
		} catch (err: any) {
			structuredLogger.error("Failed to load tags:", err);
		}
	};

	const handleTagsRebuilt = useCallback((rebuiltTags: any[]) => {
		setTags(rebuiltTags);
		LibraryStore.update((s) => {
			s.tags = rebuiltTags;
		});
	}, []);

	const aggregatedData = useMemo(() => {
		const map = new Map<any, any>();

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
			const updatedTags = await renameLibraryTag(
				tags,
				category,
				oldValue,
				newValue,
			);
			setTags(updatedTags);
		} catch (err: any) {
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
			const updatedTags = await deleteLibraryTag(tags, category, oldValue);
			setTags(updatedTags);
		} catch (err: any) {
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
			const updatedTags = await deleteLibraryTagArticles(
				tags,
				category,
				filterValue,
			);
			setTags(updatedTags);
		} catch (err: any) {
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

	const [actionItem, setActionItem] = useState<any>(null);
	const [menuPosition, setMenuPosition] = useState<any>(null);

	const handleActionMenuOpen = useCallback((event: any, item: any) => {
		event.stopPropagation();
		setMenuPosition({
			top: event.clientY,
			left: event.clientX,
		});
		setActionItem(item);
	}, []);

	const handleActionMenuClose = useCallback((event?: any) => {
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

			<TagActionDialogs
				translations={translations}
				processing={processing}
				menuPosition={menuPosition}
				actionItem={actionItem}
				onMenuClose={handleActionMenuClose}
				renameDialog={renameDialog}
				setRenameDialog={setRenameDialog}
				newValue={newValue}
				setNewValue={setNewValue}
				onRename={handleRename}
				deleteDialog={deleteDialog}
				setDeleteDialog={setDeleteDialog}
				onDelete={handleDelete}
				deleteArticlesDialog={deleteArticlesDialog}
				setDeleteArticlesDialog={setDeleteArticlesDialog}
				onDeleteArticles={handleDeleteArticles}
			/>

			{/* Sync Confirmation Dialog */}
			<SyncDialog
				open={syncDialog}
				onClose={() => setSyncDialog(false)}
				tags={tags}
			/>

			<RebuildDialog
				open={rebuildDialog}
				onClose={() => setRebuildDialog(false)}
				currentTags={tags}
				onRebuilt={handleTagsRebuilt}
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
