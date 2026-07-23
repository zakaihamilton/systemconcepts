import { MainStore } from "@components/Main";
import { registerToolbar } from "@components/Toolbar";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { SyncActiveStore } from "@sync/syncState";
import Box from "@ui/Box";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { makePath } from "@util/data/path";
import { setPath, usePathItems } from "@util/domain/views";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { useCallback, useEffect, useMemo, useState } from "react";
import Article from "../Article";
import EditContentDialog from "../EditContentDialog";
import EditTagsDialog from "../EditTagsDialog";
import { LibraryTagKeys } from "../Icons";
import { LibraryStore } from "../Store";
import styles from "./Library.module.css";

const fileCache = new Map();

registerToolbar("Library");

export default function Library() {
	// Prefer LibraryStore.tags so we stay in sync with LibraryTree/breadcrumbs when
	// the sidebar loads tags first (or this view's local read is still empty).
	const storeTags = LibraryStore.useState((s) => s.tags);
	const [localTags, setLocalTags] = useState([]);
	const tags = storeTags?.length ? storeTags : localTags;
	// Keep setTags identity stable. Depending on storeTags/localTags here recreated
	// loadTags on every successful read and retriggered the mount effect in a loop.
	const setTags = useCallback((nextTags) => {
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
	const [content, setContent] = useState(null);
	const [selectedTag, setSelectedTag] = useState(null);
	const [loading, setLoading] = useState(false);
	const pathItems = usePathItems();
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editContentDialogOpen, setEditContentDialogOpen] = useState(false);
	const [customOrder, setCustomOrder] = useState({});
	const storeSelectedId = LibraryStore.useState((s) => s.selectedId);
	const libraryUpdateCounter = SyncActiveStore.useState(
		(s) => s.libraryUpdateCounter,
	);

	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	const getTagHierarchy = useCallback((tag) => {
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
		(id) => {
			if (!id) return null;
			const needle = String(id);
			return tags.find((t) => String(t._id) === needle) || null;
		},
		[tags],
	);

	const selectTagFromIdPart = useCallback(
		(idPart) => {
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
		(tag, paragraphId = null) => {
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
		(tag) => {
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

	const loadTags = useCallback(async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const fileContents = await storage.readFile(tagsPath);
				const data = JSON.parse(fileContents);
				setTags(Array.isArray(data) ? data : []);
			}
		} catch (err) {
			structuredLogger.error("Failed to load library tags:", err);
		}
	}, [setTags]);

	const loadCustomOrder = useCallback(async () => {
		try {
			const orderPath = makePath(LIBRARY_LOCAL_PATH, "library-order.json");
			if (await storage.exists(orderPath)) {
				const fileContents = await storage.readFile(orderPath);
				const data = JSON.parse(fileContents);
				setCustomOrder(data);
			}
		} catch (err) {
			structuredLogger.error("Failed to load library order:", err);
		}
	}, []);

	useEffect(() => {
		setTimeout(() => {
			loadTags();
			loadCustomOrder();
		}, 0);
	}, [loadTags, loadCustomOrder]);

	const loadContent = useCallback(async () => {
		if (!selectedTag) {
			setContent(null);
			return;
		}

		setLoading(true);
		setContent(null);
		await new Promise((r) => setTimeout(r, 0));

		try {
			const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
			let data;

			if (fileCache.has(filePath)) {
				data = fileCache.get(filePath);
			} else if (await storage.exists(filePath)) {
				const fileContent = await storage.readFile(filePath);
				data = JSON.parse(fileContent);
				fileCache.set(filePath, data);
			} else {
				setContent("File not found.");
				return;
			}

			let item = null;
			if (Array.isArray(data)) {
				item = data.find((i) => String(i._id) === String(selectedTag._id));
			} else if (String(data._id) === String(selectedTag._id)) {
				item = data;
			}

			const contentText = item ? item.text || "" : "Content not found in file.";
			setContent(contentText);
		} catch (err) {
			structuredLogger.error("Failed to load content:", err);
			setContent("Error loading content.");
		} finally {
			setLoading(false);
		}
	}, [selectedTag]);

	useEffect(() => {
		setTimeout(() => loadContent(), 0);
	}, [loadContent]);

	useEffect(() => {
		if (libraryUpdateCounter > 0) {
			// Clear caches when library is updated

			setTimeout(() => {
				fileCache.clear();
				loadTags();
				loadCustomOrder();
				loadContent();
			}, 0);
		}
	}, [libraryUpdateCounter, loadTags, loadCustomOrder, loadContent]);

	const openEditDialog = useCallback(() => setEditDialogOpen(true), []);
	const openEditContentDialog = useCallback(
		() => setEditContentDialogOpen(true),
		[],
	);

	// Navigation between articles - flatten the tree in display order
	const sortedTags = useMemo(() => {
		if (!tags || tags.length === 0) return [];

		// We need to build the same tree structure as Tags.js and flatten it
		// Import the same sorting logic
		const root = { id: "root", name: "Library", children: [] };

		for (const tag of tags) {
			let currentLevel = root.children;
			const levels = LibraryTagKeys.map((key) => ({ key, value: tag[key] }))
				.filter((item) => item.value && String(item.value).trim())
				.map((item) => ({ key: item.key, value: String(item.value).trim() }));
			if (levels.length === 0) continue;

			const pathIds = [];
			levels.forEach((levelItem, index) => {
				const { key: type, value: name } = levelItem;
				const isHead = index < levels.length - 1;
				const nodeNumber = !isHead && tag.number ? tag.number : null;
				const idSuffix = nodeNumber ? `#${nodeNumber}` : "";

				pathIds.push(name + idSuffix);
				const id = pathIds.join("|");

				let node = currentLevel.find((n) => n.id === id);
				if (!node) {
					node = {
						id,
						name,
						type,
						children: [],
						...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {}),
					};
					currentLevel.push(node);
				}
				currentLevel = node.children;
			});
		}

		// Use the same sorting logic as Tags.js
		const numberWords = {
			one: 1,
			two: 2,
			three: 3,
			four: 4,
			five: 5,
			six: 6,
			seven: 7,
			eight: 8,
			nine: 9,
			ten: 10,
			eleven: 11,
			twelve: 12,
			thirteen: 13,
			fourteen: 14,
			fifteen: 15,
			sixteen: 16,
			seventeen: 17,
			eighteen: 18,
			nineteen: 19,
			twenty: 20,
			first: 1,
			second: 2,
			third: 3,
			fourth: 4,
			fifth: 5,
			sixth: 6,
			seventh: 7,
			eighth: 8,
			ninth: 9,
			tenth: 10,
		};

		const getPriority = (name) => {
			if (!name) return 999;
			const lowerName = name.toLowerCase().replace(/['']/g, "'");
			if (lowerName.includes("editor") && lowerName.includes("note")) return 0;
			if (lowerName.startsWith("intro")) return 1;
			if (lowerName.startsWith("preface")) return 2;
			if (lowerName.startsWith("foreword")) return 3;
			if (lowerName.startsWith("prologue")) return 4;
			if (
				lowerName.startsWith("contents") ||
				lowerName.includes("table of contents")
			)
				return 5;
			return 999;
		};

		const extractNumber = (name) => {
			if (!name) return null;
			const lowerName = name.toLowerCase();
			const candidates = [];
			const digitRegex = /(\d+)/g;
			let digitMatch;
			while ((digitMatch = digitRegex.exec(name)) !== null) {
				candidates.push({
					position: digitMatch.index,
					value: parseInt(digitMatch[1], 10),
				});
			}
			const wordRegex = /[a-z]+/gi;
			let wordMatch;
			while ((wordMatch = wordRegex.exec(lowerName)) !== null) {
				const word = wordMatch[0];
				if (numberWords[word] !== undefined) {
					candidates.push({
						position: wordMatch.index,
						value: numberWords[word],
					});
				}
			}
			if (candidates.length === 0) return null;
			candidates.sort((a, b) => a.position - b.position);
			return candidates[0];
		};

		const getBaseName = (name) => {
			if (!name) return "";
			let base = name.toLowerCase();
			base = base.replace(/\d+/g, "");
			const words = Object.keys(numberWords).sort(
				(a, b) => b.length - a.length,
			);
			words.forEach((word) => {
				const regex = new RegExp(`\\b${word}\\b`, "g");
				base = base.replace(regex, "");
			});
			return base.replace(/\s+/g, " ").trim();
		};

		const getCustomOrderVal = (name) => {
			if (!name || !customOrder) return null;
			if (customOrder[name] !== undefined) return customOrder[name];
			const lowerName = name.toLowerCase();
			for (const [key, value] of Object.entries(customOrder)) {
				if (key.toLowerCase() === lowerName) return value;
			}
			return null;
		};

		const sortTree = (nodes) => {
			nodes.sort((a, b) => {
				const nameA = a.name || "";
				const nameB = b.name || "";
				const priorityA = getPriority(nameA);
				const priorityB = getPriority(nameB);
				if (priorityA !== priorityB) return priorityA - priorityB;

				const customA = getCustomOrderVal(nameA);
				const customB = getCustomOrderVal(nameB);
				if (customA !== null && customB !== null) return customA - customB;
				if (customA !== null) return -1;
				if (customB !== null) return 1;

				const orderA =
					a.order !== undefined && a.order !== null && a.order !== ""
						? parseInt(a.order, 10)
						: null;
				const orderB =
					b.order !== undefined && b.order !== null && b.order !== ""
						? parseInt(b.order, 10)
						: null;
				if (
					orderA !== null &&
					orderB !== null &&
					!isNaN(orderA) &&
					!isNaN(orderB)
				) {
					if (orderA !== orderB) return orderA - orderB;
				}
				if (orderA !== null && !isNaN(orderA)) return -1;
				if (orderB !== null && !isNaN(orderB)) return 1;

				const tagNumA =
					a.number !== undefined && a.number !== null && a.number !== ""
						? parseInt(a.number, 10)
						: null;
				const tagNumB =
					b.number !== undefined && b.number !== null && b.number !== ""
						? parseInt(b.number, 10)
						: null;
				if (
					tagNumA !== null &&
					tagNumB !== null &&
					!isNaN(tagNumA) &&
					!isNaN(tagNumB)
				) {
					if (tagNumA !== tagNumB) return tagNumA - tagNumB;
					const subNumA =
						a.subNumber !== undefined &&
						a.subNumber !== null &&
						a.subNumber !== ""
							? parseInt(a.subNumber, 10)
							: null;
					const subNumB =
						b.subNumber !== undefined &&
						b.subNumber !== null &&
						b.subNumber !== ""
							? parseInt(b.subNumber, 10)
							: null;
					if (
						subNumA !== null &&
						subNumB !== null &&
						!isNaN(subNumA) &&
						!isNaN(subNumB)
					) {
						if (subNumA !== subNumB) return subNumA - subNumB;
					}
					if (subNumA !== null && !isNaN(subNumA)) return -1;
					if (subNumB !== null && !isNaN(subNumB)) return 1;
				}
				if (tagNumA !== null && !isNaN(tagNumA)) return -1;
				if (tagNumB !== null && !isNaN(tagNumB)) return 1;

				const candA = extractNumber(nameA);
				const candB = extractNumber(nameB);

				if (candA && candB) {
					const numA = candA.value;
					const numB = candB.value;
					const baseA = getBaseName(nameA);
					const baseB = getBaseName(nameB);
					if (baseA === baseB) return numA - numB;

					if (candA.position <= 2 && candB.position <= 2) {
						if (numA !== numB) return numA - numB;
						if (nameA.length !== nameB.length)
							return nameA.length - nameB.length;
					}

					const baseCompare = baseA.localeCompare(baseB, undefined, {
						numeric: true,
						sensitivity: "base",
					});
					if (baseCompare !== 0) return baseCompare;
					return numA - numB;
				}
				if (candA) return -1;
				if (candB) return 1;

				return nameA.localeCompare(nameB, undefined, {
					numeric: true,
					sensitivity: "base",
				});
			});
			nodes.forEach((node) => {
				if (node.children && node.children.length > 0) sortTree(node.children);
			});
		};

		sortTree(root.children);

		// Flatten the tree in depth-first order
		const flattened = [];
		const flatten = (nodes) => {
			nodes.forEach((node) => {
				if (node._id) {
					flattened.push(node);
				}
				if (node.children && node.children.length > 0) {
					flatten(node.children);
				}
			});
		};
		flatten(root.children);

		return flattened;
	}, [tags, customOrder]);

	const currentIndex = useMemo(() => {
		if (!selectedTag || sortedTags.length === 0) return -1;
		return sortedTags.findIndex(
			(tag) => String(tag._id) === String(selectedTag._id),
		);
	}, [selectedTag, sortedTags]);

	const prevArticle = currentIndex > 0 && sortedTags[currentIndex - 1];
	const nextArticle =
		currentIndex !== -1 &&
		currentIndex < sortedTags.length - 1 &&
		sortedTags[currentIndex + 1];

	const getArticleTitle = useCallback((tag) => {
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
		(tag) => {
			if (!tag) return;
			onSelect(tag);
		},
		[onSelect],
	);

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
					setContent={(newContent) => {
						setContent(newContent);
					}}
				/>
			)}
		</Box>
	);
}
