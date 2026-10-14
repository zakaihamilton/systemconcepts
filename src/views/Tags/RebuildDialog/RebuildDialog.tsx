import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { bumpLibraryCounter } from "@sync/libraryCounter";
import Box from "@ui/Box";
import Button from "@ui/Button";
import CircularProgress from "@ui/CircularProgress";
import Dialog from "@ui/Dialog";
import DialogActions from "@ui/DialogActions";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import { useCallback, useEffect, useState } from "react";
import dialog from "../../../css/dialog-patterns.module.css";

type RebuildPreview = {
	tags: any[];
	sourceFiles: number;
	added: number;
	updated: number;
	removed: number;
};

type RebuildDialogProps = {
	open: boolean;
	onClose: () => void;
	currentTags: any[];
	onRebuilt: (tags: any[]) => void;
};

const INDEX_FILES = new Set([
	"tags.json",
	"library-order.json",
	"library-counter.json",
]);

function stableSerialize(value: any): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableSerialize).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "undefined";
}

function getRelativePath(filePath: string): string | null {
	const normalizedPath = makePath(filePath).replace(/^\/+/, "");
	const libraryRoot = makePath(LIBRARY_LOCAL_PATH).replace(/^\/+/, "");
	const prefix = `${libraryRoot}/`;
	return normalizedPath.startsWith(prefix)
		? normalizedPath.slice(prefix.length)
		: null;
}

function getArticleKey(relativePath: string, id: string | number): string {
	return JSON.stringify([relativePath, String(id)]) || "";
}

function getArticleRecords(data: any, relativePath: string): any[] {
	const items = Array.isArray(data)
		? data
		: data && typeof data === "object" && !Array.isArray(data)
			? [data]
			: [];

	return items.flatMap((item) => {
		if (
			!item ||
			typeof item !== "object" ||
			Array.isArray(item) ||
			item._id === undefined ||
			item._id === null ||
			String(item._id).length === 0
		) {
			return [];
		}

		const tag = { ...item };
		delete tag.text;
		return [{ ...tag, path: relativePath }];
	});
}

export default function RebuildDialog({
	open,
	onClose,
	currentTags,
	onRebuilt,
}: RebuildDialogProps) {
	const translations = useTranslations();
	const [preview, setPreview] = useState<RebuildPreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState("");

	const calculatePreview = useCallback(async () => {
		setLoading(true);
		setPreview(null);
		setError("");

		try {
			const listing = await storage.getRecursiveList(LIBRARY_LOCAL_PATH, {
				strict: true,
			});
			const sourceFiles = listing.filter((item: any) => {
				if (item.type !== "file") return false;
				const relativePath = getRelativePath(item.path || item.id || "");
				if (!relativePath || !relativePath.toLowerCase().endsWith(".json")) {
					return false;
				}
				return !INDEX_FILES.has(
					relativePath.split("/").pop()?.toLowerCase() || "",
				);
			});

			const indexedById = new Map<string, any>();
			let sourceFileCount = 0;

			for (const sourceFile of sourceFiles) {
				const filePath = sourceFile.path || sourceFile.id;
				const relativePath = getRelativePath(filePath);
				if (!relativePath) continue;

				let data;
				try {
					data = JSON.parse(await storage.readFile(filePath));
				} catch {
					throw new Error(`Could not read ${relativePath} as valid JSON.`);
				}

				sourceFileCount++;
				for (const tag of getArticleRecords(data, relativePath)) {
					const id = getArticleKey(relativePath, tag._id);
					indexedById.set(id, tag);
				}
			}

			const rebuiltTags = Array.from(indexedById.values());
			if (rebuiltTags.length === 0) {
				throw new Error(
					translations.NO_LIBRARY_ARTICLES_FOUND ||
						"No article records were found in the library JSON files.",
				);
			}

			const existingById = new Map<string, any>();
			const existingTags = Array.isArray(currentTags) ? currentTags : [];
			existingTags.forEach((tag) => {
				if (tag?._id !== undefined && tag?._id !== null && tag?.path) {
					existingById.set(getArticleKey(tag.path, tag._id), tag);
				}
			});

			let added = 0;
			let updated = 0;
			for (const [id, tag] of indexedById) {
				const existing = existingById.get(id);
				if (!existing) {
					added++;
				} else if (stableSerialize(existing) !== stableSerialize(tag)) {
					updated++;
				}
			}

			let removed = 0;
			for (const id of existingById.keys()) {
				if (!indexedById.has(id)) removed++;
			}

			setPreview({
				tags: rebuiltTags,
				sourceFiles: sourceFileCount,
				added,
				updated,
				removed,
			});
		} catch (err: any) {
			structuredLogger.error("Failed to rebuild library tag index:", err);
			setError(
				err?.message ||
					translations.FAILED_TO_REBUILD_TAGS ||
					"Failed to scan library article files.",
			);
		} finally {
			setLoading(false);
		}
	}, [currentTags, translations]);

	useEffect(() => {
		if (open) {
			calculatePreview();
		} else {
			setPreview(null);
			setError("");
		}
	}, [open, calculatePreview]);

	const handleRebuild = async () => {
		if (!preview) return;

		setProcessing(true);
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			await storage.writeFile(tagsPath, JSON.stringify(preview.tags, null, 2));
			await bumpLibraryCounter();
			onRebuilt(preview.tags);
			onClose();
		} catch (err: any) {
			structuredLogger.error("Failed to write rebuilt library tag index:", err);
			setError(
				err?.message ||
					translations.FAILED_TO_REBUILD_TAGS ||
					"Failed to update the library tag index.",
			);
		} finally {
			setProcessing(false);
		}
	};

	const hasChanges =
		!!preview && !!(preview.added || preview.updated || preview.removed);

	return (
		<Dialog
			open={open}
			onClose={() => !processing && onClose()}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle className={dialog.titleBold}>
				{translations.REBUILD_LIBRARY_TAGS || "Rebuild Library Tags"}
			</DialogTitle>
			<DialogContent dividers>
				<Typography gutterBottom>
					{translations.REBUILD_LIBRARY_TAGS_HELP ||
						"Scan article JSON files in the local library and refresh the tag list, including newly added articles."}
				</Typography>
				{loading ? (
					<Box className={dialog.flexCenterP4}>
						<CircularProgress />
					</Box>
				) : error ? (
					<Typography color="error">{error}</Typography>
				) : preview ? (
					<Box>
						<Typography>
							{translations.SOURCE_FILES_SCANNED || "Source files scanned"}:{" "}
							{preview.sourceFiles}
						</Typography>
						<Typography>
							{translations.ARTICLES || "Articles"}: {preview.tags.length}
						</Typography>
						<Typography>
							{translations.NEW || "New"}: {preview.added}
						</Typography>
						<Typography>
							{translations.UPDATED || "Updated"}: {preview.updated}
						</Typography>
						<Typography>
							{translations.REMOVED || "Removed"}: {preview.removed}
						</Typography>
						{!hasChanges && (
							<Typography color="text.secondary" style={{ marginTop: 8 }}>
								{translations.TAG_INDEX_UP_TO_DATE ||
									"The tag index is already up to date."}
							</Typography>
						)}
					</Box>
				) : null}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={processing}>
					{translations.CANCEL}
				</Button>
				<Button
					variant="contained"
					onClick={handleRebuild}
					disabled={loading || processing || !hasChanges || !!error}
				>
					{processing
						? translations.UPDATING || "Updating..."
						: translations.APPLY_REBUILD || "Rebuild"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
