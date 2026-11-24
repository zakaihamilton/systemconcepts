import ClearIcon from "@icons/svg/Clear.svg";
import FilterAltIcon from "@icons/svg/FilterAlt.svg";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { SyncActiveStore } from "@sync/syncState";
import Box from "@ui/Box";
import IconButton from "@ui/IconButton";
import InputAdornment from "@ui/InputAdornment";
import List from "@ui/List";
import TextField from "@ui/TextField";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import { setPath, usePathItems } from "@util/domain/views";
import storage from "@util/storage/storage";
import { LibraryStore } from "@views/Library/Store";
import TreeItem from "@views/Library/TreeItem";
import Tooltip from "@widgets/Tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildLibraryTree, type LibraryTreeNode } from "./buildLibraryTree";
import styles from "./LibraryTree.module.css";
import { resolveLibraryRoute } from "./resolveLibraryRoute";

export default function LibraryTree({ closeDrawer, isMobile }: any) {
	const translations = useTranslations();
	const [filterText, setFilterText] = useState("");
	const [debouncedFilterText, setDebouncedFilterText] = useState("");
	const [tags, setTags] = useState<any[]>([]);
	const [customOrder, setCustomOrder] = useState<Record<string, any>>({});
	const pathItems = usePathItems();
	const libraryUpdateCounter = SyncActiveStore.useState(
		(s) => s.libraryUpdateCounter,
	);
	const scrollToPath = LibraryStore.useState((s) => s.scrollToPath);
	const treeContainerRef = useRef<any>(null);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedFilterText(filterText);
		}, 500);
		return () => clearTimeout(handler);
	}, [filterText]);

	// Handle scroll-to-path from breadcrumb clicks
	useEffect(() => {
		if (scrollToPath) {
			LibraryStore.update((s) => {
				s.selectPath = scrollToPath;
			});
			// Clear the scrollToPath after a delay
			setTimeout(() => {
				LibraryStore.update((s) => {
					s.scrollToPath = null;
				});
				// Clear highlight after scroll animation completes
				setTimeout(() => {
					LibraryStore.update((s) => {
						s.selectPath = null;
					});
				}, 1000);
			}, 100);
		}
	}, [scrollToPath]);

	const loadTags = useCallback(async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const fileContents = await storage.readFile(tagsPath);
				const data = JSON.parse(fileContents);
				setTags(data);
				LibraryStore.update((s) => {
					s.tags = data;
				});
			}
		} catch (err: any) {
			structuredLogger.error("Failed to load library tags:", err);
		}
	}, []);

	const loadCustomOrder = useCallback(async () => {
		try {
			const orderPath = makePath(LIBRARY_LOCAL_PATH, "library-order.json");
			if (await storage.exists(orderPath)) {
				const fileContents = await storage.readFile(orderPath);
				const data = JSON.parse(fileContents);
				setCustomOrder(data);
			}
		} catch (err: any) {
			structuredLogger.error("Failed to load library order:", err);
		}
	}, []);

	useEffect(() => {
		setTimeout(() => {
			loadTags();
			loadCustomOrder();
		}, 0);
	}, [loadTags, loadCustomOrder]);

	useEffect(() => {
		if (libraryUpdateCounter > 0) {
			setTimeout(() => {
				loadTags();
				loadCustomOrder();
			}, 0);
		}
	}, [libraryUpdateCounter, loadTags, loadCustomOrder]);

	useEffect(() => {
		const resolved = resolveLibraryRoute(tags, pathItems);
		if (!resolved) return;

		const { tag, paragraphId, urlPath, parentIds } = resolved;
		if (tag) {
			LibraryStore.update((s) => {
				const pathChanged = s.selectedId !== tag._id;
				s.selectedId = tag._id;
				// Only request sidebar scroll when the selected article changes
				if (pathChanged) {
					s.selectPath = urlPath;
				}
				s.expandedNodes = [...new Set([...s.expandedNodes, ...parentIds])];
				if (paragraphId) {
					s.scrollToParagraph = paragraphId;
				}
			});
		} else {
			LibraryStore.update((s) => {
				s.selectedId = null;
				s.selectPath = null;
			});
		}
	}, [tags, pathItems]);

	const tree = useMemo<LibraryTreeNode[]>(
		() => buildLibraryTree(tags, debouncedFilterText, customOrder),
		[tags, debouncedFilterText, customOrder],
	);

	const onSelect = useCallback(
		(tag: any) => {
			LibraryStore.update((s) => {
				s.selectedId = tag._id;
			});
			if (tag?._id) {
				setPath("library", "id", tag._id);
			}
			LibraryStore.update((s) => {
				s.lastViewedArticle = tag;
			});
			if (isMobile && closeDrawer) {
				closeDrawer();
			}
		},
		[isMobile, closeDrawer],
	);

	const handleToggle = useCallback(
		(nodeId: any, isExpanding: any) => {
			if (isExpanding) {
				const siblingIds = tree
					.map((node) => node.id)
					.filter((id) => id !== nodeId);
				LibraryStore.update((s) => {
					s.expandedNodes = s.expandedNodes.filter(
						(id) => !siblingIds.includes(id),
					);
					if (!s.expandedNodes.includes(nodeId)) {
						s.expandedNodes = [...s.expandedNodes, nodeId];
					}
				});
			} else {
				LibraryStore.update((s) => {
					s.expandedNodes = s.expandedNodes.filter((id) => id !== nodeId);
				});
			}
		},
		[tree],
	);

	if (!tags || tags.length === 0) {
		return null;
	}

	return (
		<Box className={styles.root}>
			<Box className={styles.searchContainer}>
				<TextField
					placeholder={translations.FILTER_TAGS || "Filter tags..."}
					value={filterText}
					onChange={(e: any) => setFilterText(e.target.value)}
					fullWidth
					size="small"
					className={styles.filterInput}
					startAdornment={
						<InputAdornment position="start">
							<FilterAltIcon color="action" fontSize="small" />
						</InputAdornment>
					}
					endAdornment={
						filterText ? (
							<InputAdornment position="end">
								<Tooltip title={translations.CLEAR_FILTER}>
									<IconButton
										size="small"
										onClick={() => setFilterText("")}
										edge="end"
										className={styles.clearButton}
										aria-label={translations.CLEAR_FILTER}
									>
										<ClearIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</InputAdornment>
						) : null
					}
				/>
			</Box>
			<Box className={styles.treeContainer} ref={treeContainerRef}>
				<List component="nav" className={styles.treeList}>
					{tree.map((node) => (
						<TreeItem
							key={node.id}
							node={node}
							onSelect={onSelect}
							onToggle={handleToggle}
							level={0}
						/>
					))}
				</List>
			</Box>
		</Box>
	);
}
