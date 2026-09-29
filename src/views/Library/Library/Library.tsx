import { MainStore } from "@components/Main";
import { registerToolbar } from "@components/Toolbar";
import { SyncActiveStore } from "@sync/syncState";
import Box from "@ui/Box";
import { roleAuth } from "@util/auth/roles";
import { setPath, usePathItems } from "@util/domain/views";
import Cookies from "js-cookie";
import { useCallback, useEffect, useMemo, useState } from "react";
import Article from "../Article";
import EditContentDialog from "../EditContentDialog";
import EditTagsDialog from "../EditTagsDialog";
import { LibraryTagKeys } from "../Icons";
import { LibraryStore } from "../Store";
import styles from "./Library.module.css";
import { sortLibraryTags } from "./sortLibraryTags";
import { useLibraryFiles } from "./useLibraryFiles";

registerToolbar("Library");

export default function Library() {
	// Prefer LibraryStore.tags so we stay in sync with LibraryTree/breadcrumbs when
	// the sidebar loads tags first (or this view's local read is still empty).
	const storeTags = LibraryStore.useState((s) => s.tags);
	const [localTags, setLocalTags] = useState<any[]>([]);
	const tags = storeTags?.length ? storeTags : localTags;
	// Keep setTags identity stable. Depending on storeTags/localTags here recreated
	// loadTags on every successful read and retriggered the mount effect in a loop.
	const setTags = useCallback((nextTags: any) => {
		setLocalTags((prevLocal) => {
			const storeTagsNow = LibraryStore.getRawState().tags;
			const base = storeTagsNow?.length ? storeTagsNow : prevLocal;
			const resolved =
				typeof nextTags === "function" ? nextTags(base) : nextTags;
			LibraryStore.update((s) => {
				s.tags = resolved;
			});
			return resolved;
		});
	}, []);
	const [content, setContent] = useState<any>(null);
	const [selectedTag, setSelectedTag] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const pathItems = usePathItems();
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editContentDialogOpen, setEditContentDialogOpen] = useState(false);
	const [customOrder, setCustomOrder] = useState<Record<string, any>>({});
	const storeSelectedId = LibraryStore.useState((s) => s.selectedId);
	const libraryUpdateCounter = SyncActiveStore.useState(
		(s) => s.libraryUpdateCounter,
	);
	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	const getTagHierarchy = useCallback((tag: any) => {
		const hierarchy = LibraryTagKeys.map((key) => tag[key])
			.map((v) => (v ? String(v).trim() : null))
			.filter(Boolean);
		if (tag.number && hierarchy.length > 0) {
			hierarchy[hierarchy.length - 1] =
				`${hierarchy[hierarchy.length - 1]}:${tag.number}`;
		}
		return hierarchy;
	}, []);

	const findTagById = useCallback(
		(id: any) => {
			if (!id) return null;
			const needle = String(id);
			return tags.find((t) => String(t._id) === needle) || null;
		},
		[tags],
	);

	const selectTagFromIdPart = useCallback(
		(idPart: any) => {
			if (!idPart) return { tag: null, paragraphId: null };
			const colonIndex = idPart.lastIndexOf(":");
			const id = colonIndex !== -1 ? idPart.substring(0, colonIndex) : idPart;
			const possibleParagraph =
				colonIndex !== -1 ? idPart.substring(colonIndex + 1) : null;
			let paragraphId = null;
			if (possibleParagraph && !isNaN(parseInt(possibleParagraph, 10))) {
				paragraphId = parseInt(possibleParagraph, 10);
			}
			return { tag: findTagById(id), paragraphId };
		},
		[findTagById],
	);

	const applySelectedTag = useCallback(
		(tag: any, paragraphId: number | null = null) => {
			if (!tag) return;
			if (!selectedTag || String(tag._id) !== String(selectedTag._id)) {
				setLoading(true);
				setContent(null);
				setSelectedTag(tag);
				LibraryStore.update((s) => {
					s.lastViewedArticle = tag;
					s.selectedId = tag._id;
					if (paragraphId) {
						s.scrollToParagraph = paragraphId;
					}
				});
			} else if (paragraphId) {
				LibraryStore.update((s) => {
					s.scrollToParagraph = paragraphId;
				});
			}
		},
		[selectedTag],
	);

	// When the sidebar resolves a deep link first, mirror that selection into the
	// article pane even if our path effect has not caught up yet.
	useEffect(() => {
		if (!storeSelectedId || !tags.length) return;
		if (selectedTag && String(selectedTag._id) === String(storeSelectedId)) {
			return;
		}
		const tag = findTagById(storeSelectedId);
		if (!tag) return;
		setLoading(true);
		setContent(null);
		setSelectedTag(tag);
	}, [storeSelectedId, tags, selectedTag, findTagById]);

	const onSelect = useCallback(
		(tag: any) => {
			if (!selectedTag || String(tag._id) !== String(selectedTag._id)) {
				setLoading(true);
				setContent(null);
			}
			setSelectedTag(tag);
			if (tag?._id) {
				setPath("library", "id", tag._id);
			}
			// Remember the last viewed article
			LibraryStore.update((s) => {
				s.lastViewedArticle = tag;
				s.selectedId = tag?._id ?? null;
			});
		},
		[selectedTag],
	);

	useEffect(() => {
		if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
			let tag = null;
			let paragraphId = null;

			if (pathItems[1] === "id") {
				({ tag, paragraphId } = selectTagFromIdPart(pathItems[2]));
			} else {
				const urlPath = pathItems.slice(1).join("|");
				// Try explicit match first
				tag = tags.find((t) => getTagHierarchy(t).join("|") === urlPath);

				// If no match, check for paragraph suffix (e.g. :8)
				if (!tag) {
					const parts = urlPath.split("|");
					const lastPart = parts[parts.length - 1];
					const lastSepIndex = lastPart.lastIndexOf(":");
					if (lastSepIndex !== -1) {
						const possibleParagraph = lastPart.slice(lastSepIndex + 1);
						if (!isNaN(parseInt(possibleParagraph, 10))) {
							paragraphId = parseInt(possibleParagraph, 10);
							tag = tags.find((t) => {
								const h = getTagHierarchy(t);
								const hStr = h.join("|");

								const urlLastSep = urlPath.lastIndexOf(":");
								const urlBase =
									urlLastSep !== -1
										? urlPath.substring(0, urlLastSep)
										: urlPath;

								if (hStr === urlPath) return true;
								if (hStr === urlBase) return true;

								const tagLastSep = hStr.lastIndexOf(":");
								if (tagLastSep !== -1) {
									const tagBase = hStr.substring(0, tagLastSep);
									if (tagBase === urlBase) return true;
								}
								return false;
							});
						}
					}
				}
			}

			applySelectedTag(tag, paragraphId);
		} else if (
			tags.length > 0 &&
			pathItems.length === 1 &&
			pathItems[0] === "library"
		) {
			// MainStore.hash can briefly lag behind the address bar. Prefer the live
			// URL so #library/id/<id> still selects the article.
			const windowPath = (window.location.hash || "")
				.replace(/^#/, "")
				.split("/")
				.filter(Boolean)
				.map((item) => {
					try {
						return decodeURIComponent(item);
					} catch {
						return item;
					}
				});
			if (
				windowPath[0] === "library" &&
				windowPath[1] === "id" &&
				windowPath[2]
			) {
				MainStore.update((s) => {
					s.hash = window.location.hash;
				});
				const { tag, paragraphId } = selectTagFromIdPart(windowPath[2]);
				applySelectedTag(tag, paragraphId);
				return;
			}
			// If we're on the root library page, restore the last viewed article
			const { lastViewedArticle } = LibraryStore.getRawState();
			if (lastViewedArticle) {
				const tag = findTagById(lastViewedArticle._id);
				if (
					tag &&
					(!selectedTag || String(tag._id) !== String(selectedTag._id))
				) {
					setTimeout(() => onSelect(tag), 0);
				}
			}
		}
	}, [
		tags,
		pathItems,
		getTagHierarchy,
		onSelect,
		selectedTag,
		selectTagFromIdPart,
		applySelectedTag,
		findTagById,
	]);

	const openEditDialog = useCallback(() => setEditDialogOpen(true), []);
	const openEditContentDialog = useCallback(
		() => setEditContentDialogOpen(true),
		[],
	);

	// Navigation between articles - flatten the tree in display order
	const sortedTags = useMemo(
		() => sortLibraryTags(tags, customOrder),
		[tags, customOrder],
	);

	const currentIndex = useMemo(() => {
		if (!selectedTag || sortedTags.length === 0) return -1;
		return sortedTags.findIndex(
			(tag: any) => String(tag._id) === String(selectedTag._id),
		);
	}, [selectedTag, sortedTags]);

	const prevArticle = currentIndex > 0 && sortedTags[currentIndex - 1];
	const nextArticle =
		currentIndex !== -1 &&
		currentIndex < sortedTags.length - 1 &&
		sortedTags[currentIndex + 1];

	const getArticleTitle = useCallback((tag: any) => {
		if (!tag) return "";
		for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
			const key = LibraryTagKeys[i];
			const value = tag[key];
			if (value && String(value).trim()) {
				return value;
			}
		}
		return "";
	}, []);

	const prevArticleName = useMemo(
		() => getArticleTitle(prevArticle),
		[prevArticle, getArticleTitle],
	);
	const nextArticleName = useMemo(
		() => getArticleTitle(nextArticle),
		[nextArticle, getArticleTitle],
	);

	const gotoArticle = useCallback(
		(tag: any) => {
			if (!tag) return;
			onSelect(tag);
		},
		[onSelect],
	);

	useLibraryFiles({
		selectedTag,
		setContent,
		setLoading,
		setTags,
		setCustomOrder,
		libraryUpdateCounter,
	});

	return (
		<Box className={styles.root}>
			<Article
				selectedTag={selectedTag}
				content={content}
				openEditDialog={openEditDialog}
				openEditContentDialog={openEditContentDialog}
				loading={loading}
				prevArticle={{ name: prevArticleName, tag: prevArticle }}
				nextArticle={{ name: nextArticleName, tag: nextArticle }}
				onPrev={() => prevArticle && gotoArticle(prevArticle)}
				onNext={() => nextArticle && gotoArticle(nextArticle)}
			/>

			{isAdmin && selectedTag && (
				<EditTagsDialog
					open={editDialogOpen}
					onClose={() => setEditDialogOpen(false)}
					selectedTag={selectedTag}
					tags={tags}
					setTags={setTags}
					setSelectedTag={setSelectedTag}
					setContent={setContent}
				/>
			)}

			{isAdmin && selectedTag && (
				<EditContentDialog
					open={editContentDialogOpen}
					onClose={() => setEditContentDialogOpen(false)}
					selectedTag={selectedTag}
					content={content}
					setContent={(newContent: any) => {
						setContent(newContent);
					}}
				/>
			)}
		</Box>
	);
}
