import VariableSizeList from "@components/Virtualized/VariableSizeList";
import { useSize } from "@util/browser/size";
import { setHash, setPath, usePathItems } from "@util/domain/views";
import JumpDialog from "@views/Library/Article/JumpDialog";
import ScrollToTop from "@views/Library/Article/ScrollToTop";
import { LibraryStore } from "@views/Library/Store";
import Box from "@ui/Box";
import Typography from "@ui/Typography";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import PageIndicator from "../PageIndicator";
import styles from "../Research.module.css";
import ResultsOutline from "../ResultsOutline";
import SearchResultItem from "../SearchResultItem";

export function useResearchResultsList({
	filteredResults,
	highlight,
	matchCounts,
	totalMatches,
	hasSearched,
	filterDrawerOpen,
	translations,
	searchCollapsed,
	setSearchCollapsed,
	isMobile,
	jumpOpen,
	setJumpOpen,
	contentWidth,
	listRef,
}) {
	const listContainerRef = useRef(null);
	const rowHeights = useRef({});
	const outerRef = useRef(null);
	const [scrollPages, setScrollPages] = useState({
		page: 1,
		count: 1,
		visible: false,
	});
	const scrollTimeoutRef = useRef(null);
	const listSize = useSize(listContainerRef, [searchCollapsed, hasSearched]);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [resultsOutlineOpen, setResultsOutlineOpen] = useState(false);
	const [resultsOutlineAnchor, setResultsOutlineAnchor] = useState(null);
	const resultsOutlineOpenRef = useRef(false);
	const isJumping = useRef(false);
	const jumpTimeout = useRef(null);
	const resetTimer = useRef(null);
	const minResetIndex = useRef(Infinity);
	const currentPageRef = useRef(1);
	const pendingPathRef = useRef(null);
	const initialUrlHandled = useRef(false);
	const pathItems = usePathItems();

	useEffect(() => {
		currentPageRef.current = scrollPages.page;
	}, [scrollPages.page]);

	const setRowHeight = useCallback((index, height) => {
		if (Math.abs((rowHeights.current[index] || 0) - height) > 5) {
			rowHeights.current[index] = height;
			minResetIndex.current = Math.min(minResetIndex.current, index);
			if (listRef.current) {
				if (resetTimer.current) {
					clearTimeout(resetTimer.current);
				}
				resetTimer.current = setTimeout(() => {
					if (listRef.current) {
						listRef.current.resetAfterIndex(minResetIndex.current);
						minResetIndex.current = Infinity;
					}
					resetTimer.current = null;
				}, 200);
			}
		}
	}, [listRef]);

	const gotoArticle = useCallback((tag, paragraphId) => {
		if (tag._id && tag._id.startsWith("session|")) {
			const parts = tag._id.split("|");
			if (parts.length >= 5) {
				const group = parts[1];
				const year = parts[2];
				const date = parts[3];
				const name = parts.slice(4).join("|");
				setHash(
					`session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`,
				);
			}
			return;
		}
		if (tag?._id) {
			const path =
				paragraphId !== undefined ? `${tag._id}:${paragraphId + 1}` : tag._id;
			setPath("library", "id", path);
		}
	}, []);

	const handleJumpSubmit = useCallback(
		(type, value) => {
			setJumpOpen(false);
			isJumping.current = true;
			initialUrlHandled.current = true;
			if (jumpTimeout.current) clearTimeout(jumpTimeout.current);

			if (type === "page" && listRef.current) {
				const index = value - 1;
				if (index >= 0 && index < filteredResults.length) {
					listRef.current.scrollToItem(index, "start");
				}
			} else if (type === "paragraph" && listRef.current) {
				const matchIndex = value;
				const docIndex = matchCounts.findIndex(
					(m) => matchIndex >= m.start && matchIndex <= m.total,
				);
				if (docIndex !== -1) {
					listRef.current.scrollToItem(docIndex, "start");
					const doc = filteredResults[docIndex];
					const matchInDoc = doc.matches.find(
						(m) =>
							matchCounts[docIndex].start + doc.matches.indexOf(m) ===
							matchIndex,
					);
					if (matchInDoc) {
						LibraryStore.update((s) => {
							s.scrollToParagraph = matchInDoc.index + 1;
						});
					}
				}
			}

			jumpTimeout.current = setTimeout(() => {
				isJumping.current = false;
			}, 1000);
		},
		[filteredResults, matchCounts, listRef, setJumpOpen],
	);

	useEffect(() => {
		if (filteredResults.length > 0) {
			const path = pathItems[0];
			const lastPart = path?.split(":")[1];
			if (pathItems.length === 1 && path?.startsWith("research") && lastPart) {
				if (path === pendingPathRef.current) {
					pendingPathRef.current = null;
					return;
				}
				pendingPathRef.current = null;

				const articleNumber = parseInt(lastPart, 10);
				const index = articleNumber - 1;
				if (!isNaN(index) && index >= 0 && index < filteredResults.length) {
					if (currentPageRef.current !== articleNumber) {
						isJumping.current = true;
						if (jumpTimeout.current) clearTimeout(jumpTimeout.current);
						listRef.current.scrollToItem(index, "start");
						jumpTimeout.current = setTimeout(() => {
							isJumping.current = false;
							initialUrlHandled.current = true;
						}, 1000);
						return;
					}
				}
			}
			initialUrlHandled.current = true;
		}
	}, [pathItems, filteredResults, listRef]);

	const getItemSize = useCallback(
		(index) => {
			if (rowHeights.current[index]) return rowHeights.current[index];
			const doc = filteredResults[index];
			const matchCount = doc?.matches?.length || 1;
			return 400 + matchCount * 200;
		},
		[filteredResults],
	);

	useEffect(() => {
		rowHeights.current = {};
		if (listRef.current) {
			listRef.current.resetAfterIndex(0);
		}
	}, [filteredResults, listRef]);

	useEffect(() => {
		if (hasSearched && filteredResults.length > 0) {
			setScrollPages((prev) => ({ ...prev, visible: true }));
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
			scrollTimeoutRef.current = setTimeout(() => {
				if (resultsOutlineOpenRef.current) return;
				setScrollPages((prev) => ({ ...prev, visible: false }));
			}, 1500);
		}
	}, [hasSearched, filteredResults]);

	const scrollToTop = useCallback(() => {
		if (listRef.current) {
			listRef.current.scrollToItem(0, "start");
		}
	}, [listRef]);

	const closeResultsOutline = useCallback(() => {
		resultsOutlineOpenRef.current = false;
		setResultsOutlineOpen(false);
		setResultsOutlineAnchor(null);
	}, []);

	const openResultsOutline = useCallback((event) => {
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
			scrollTimeoutRef.current = null;
		}
		resultsOutlineOpenRef.current = true;
		setResultsOutlineAnchor(event.currentTarget);
		setResultsOutlineOpen(true);
		setScrollPages((prev) => ({ ...prev, visible: true }));
	}, []);

	const handleResultsOutlineSelect = useCallback(
		(index) => {
			closeResultsOutline();
			isJumping.current = true;
			if (jumpTimeout.current) clearTimeout(jumpTimeout.current);

			const scrollToResult = () => {
				if (listRef.current && index >= 0) {
					listRef.current.scrollToItem(index, "start");
				}
			};

			scrollToResult();
			requestAnimationFrame(scrollToResult);
			const realignTimer = setTimeout(scrollToResult, 250);
			jumpTimeout.current = setTimeout(() => {
				clearTimeout(realignTimer);
				isJumping.current = false;
			}, 1000);
		},
		[closeResultsOutline, listRef],
	);

	const itemData = useMemo(
		() => ({
			results: filteredResults,
			gotoArticle,
			setRowHeight,
			listRef,
			highlight,
			translations,
		}),
		[
			filteredResults,
			gotoArticle,
			setRowHeight,
			listRef,
			highlight,
			translations,
		],
	);

	const handleItemsRendered = useCallback(
		({ visibleStartIndex }) => {
			const page = visibleStartIndex + 1;
			const count = filteredResults.length;
			setScrollPages((prev) => {
				if (
					prev.page === page &&
					prev.count === count &&
					prev.visible === true
				)
					return prev;
				return { ...prev, page, count, visible: true };
			});

			const currentPath = `research:${page}`;
			if (
				!isJumping.current &&
				pathItems[0] !== currentPath &&
				initialUrlHandled.current
			) {
				pendingPathRef.current = currentPath;
				setPath(currentPath);
			}

			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
			scrollTimeoutRef.current = setTimeout(() => {
				if (resultsOutlineOpenRef.current) return;
				setScrollPages((prev) => ({ ...prev, visible: false }));
			}, 1500);

			if (isMobile) {
				setSearchCollapsed(visibleStartIndex > 0);
			}
			setShowScrollTop(visibleStartIndex > 0);
		},
		[filteredResults.length, isMobile, pathItems, setSearchCollapsed],
	);

	return {
		listContainerRef,
		outerRef,
		listSize,
		scrollPages,
		showScrollTop,
		resultsOutlineOpen,
		resultsOutlineAnchor,
		itemData,
		getItemSize,
		scrollToTop,
		openResultsOutline,
		closeResultsOutline,
		handleResultsOutlineSelect,
		handleJumpSubmit,
		handleItemsRendered,
		listWidth: Math.max(1, listSize.width || contentWidth - 32),
		listHeight: Math.max(1, listSize.height),
		jumpDialogProps: {
			open: jumpOpen,
			onClose: () => setJumpOpen(false),
			onSubmit: handleJumpSubmit,
			maxPage: filteredResults.length,
			maxParagraphs: totalMatches,
			pageLabel: translations.ARTICLE,
			pageNumberLabel: translations.ARTICLE_NUMBER,
			paragraphLabel: translations.MATCH,
			paragraphNumberLabel: translations.MATCH_NUMBER,
			title: translations.JUMP_TO_ARTICLE,
		},
	};
}
