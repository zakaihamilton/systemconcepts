import { ContentSize } from "@components/Page/Content";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import VariableSizeList from "@components/Virtualized/VariableSizeList";
import ClearIcon from "@icons/svg/Clear.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import FilterAltIcon from "@icons/svg/FilterAlt.svg";
import FormatListNumberedIcon from "@icons/svg/FormatListNumbered.svg";
import PrintIcon from "@icons/svg/Print.svg";
import RefreshIcon from "@icons/svg/Refresh.svg";
import SearchIcon from "@icons/svg/Search.svg";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { SyncActiveStore } from "@sync/syncState";
import Badge from "@ui/Badge";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Chip from "@ui/Chip";
import ClickAwayListener from "@ui/ClickAwayListener";
import Drawer from "@ui/Drawer";
import IconButton from "@ui/IconButton";
import InputAdornment from "@ui/InputAdornment";
import LinearProgress from "@ui/LinearProgress";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import ListItemButton from "@ui/ListItemButton";
import ListItemText from "@ui/ListItemText";
import Paper from "@ui/Paper";
import { Tab, Tabs } from "@ui/Tabs";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { useSize } from "@util/browser/size";
import { useDeviceType } from "@util/browser/styles";
import { makePath } from "@util/data/path";
import { decodeBinaryIndex } from "@util/data/searchIndexBinary";
import { normalizeContent } from "@util/data/string";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath, usePathItems } from "@util/domain/views";
import storage from "@util/storage/storage";
import Article from "@views/Library/Article";
import JumpDialog from "@views/Library/Article/JumpDialog";
import ScrollToTop from "@views/Library/Article/ScrollToTop";
import { LibraryTagKeys } from "@views/Library/Icons";
import { LibraryStore } from "@views/Library/Store";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import Cookies from "js-cookie";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import PageIndicator from "./PageIndicator";
import styles from "./Research.module.css";
import ResultsOutline from "./ResultsOutline";
import { runResearchSearch } from "./runResearchSearch";
import SearchResultItem from "./SearchResultItem";
import {
	filterResearchResults,
	sanitizeResearchFilterTags,
} from "./searchFilters";
import { getResearchSuggestions } from "./searchQuery";

const INDEX_FILE = "search_index.bin";
const LEGACY_INDEX_FILE = "search_index.json";

registerToolbar("Research");

export default function Research() {
	const translations = useTranslations();
	const {
		query,
		filterTags,
		results,
		hasSearched,
		_loaded,
		highlight,
		indexing,
		progress,
		status,
		indexTimestamp,
		source = "all",
	} = ResearchStore.useState();
	const [sessions] = useSessions([], { filterSessions: false, skipSync: true });
	const [indexData, setIndexData] = useState(null);
	const [availableFilters, setAvailableFilters] = useState([]);
	const libraryUpdateCounter = SyncActiveStore.useState(
		(s) => s.libraryUpdateCounter,
	);
	const [searching, setSearching] = useState(false);
	const [searchProgress, setSearchProgress] = useState(0);
	const [showProgress, setShowProgress] = useState(false);
	const searchTimer = useRef(null);
	const progressHideTimer = useRef(null);
	const isMounted = useRef(true);
	const size = useContext(ContentSize);
	const listRef = useRef();
	const listContainerRef = useRef(null);
	const rowHeights = useRef({});
	const deviceType = useDeviceType();
	const isMobile = deviceType !== "desktop";
	const outerRef = useRef(null);
	const [scrollPages, setScrollPages] = useState({
		page: 1,
		count: 1,
		visible: false,
	});
	const scrollTimeoutRef = useRef(null);
	const [appliedFilterTags, setAppliedFilterTags] = useState(
		hasSearched ? filterTags : [],
	);
	const [searchCollapsed, setSearchCollapsed] = useState(false);
	const listSize = useSize(listContainerRef, [searchCollapsed, hasSearched]);
	const [jumpOpen, setJumpOpen] = useState(false);
	const [printing, setPrinting] = useState(false);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [printRoot, setPrintRoot] = useState(null);
	const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
	const [filterListQuery, setFilterListQuery] = useState("");
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [activeSuggestion, setActiveSuggestion] = useState(-1);
	const [resultsOutlineOpen, setResultsOutlineOpen] = useState(false);
	const [resultsOutlineAnchor, setResultsOutlineAnchor] = useState(null);
	const resultsOutlineOpenRef = useRef(false);
	const searchRequestId = useRef(0);
	const isJumping = useRef(false);
	const jumpTimeout = useRef(null);
	const resetTimer = useRef(null);
	const currentPageRef = useRef(1);
	const pendingPathRef = useRef(null);
	const initialUrlHandled = useRef(false);
	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	useEffect(() => {
		currentPageRef.current = scrollPages.page;
	}, [scrollPages.page]);

	useEffect(() => {
		let element = document.getElementById("print-root");
		if (!element) {
			element = document.createElement("div");
			element.id = "print-root";
			document.body.appendChild(element);
		}
		setPrintRoot(element);
		return () => {
			if (element && document.body.contains(element)) {
				document.body.removeChild(element);
			}
		};
	}, []);

	const handlePrint = useCallback(() => {
		document.body.classList.add("research-printing");
		setPrinting(true);
		setTimeout(() => {
			window.print();
			setPrinting(false);
			document.body.classList.remove("research-printing");
		}, 500);
	}, []);

	const minResetIndex = useRef(Infinity);

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
	}, []);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
			if (progressHideTimer.current) {
				clearTimeout(progressHideTimer.current);
			}
		};
	}, []);

	const setQuery = useCallback((val) => {
		ResearchStore.update((s) => {
			s.query = val;
		});
	}, []);

	const setFilterTags = useCallback((val) => {
		ResearchStore.update((s) => {
			s.filterTags = val;
		});
	}, []);

	// Drop retired Transcriptions filters restored from localStorage.
	useEffect(() => {
		if (!_loaded) return;
		const cleaned = sanitizeResearchFilterTags(filterTags, translations);
		if (cleaned.length === filterTags.length) return;
		setFilterTags(cleaned);
		setAppliedFilterTags((prev) =>
			sanitizeResearchFilterTags(prev, translations),
		);
	}, [_loaded, filterTags, translations, setFilterTags]);

	const setResults = useCallback((val) => {
		ResearchStore.update((s) => {
			s.results = val;
		});
	}, []);

	const setSource = useCallback((value) => {
		ResearchStore.update((s) => {
			s.source = value;
		});
	}, []);

	const loadTags = useCallback(async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const tagsContent = await storage.readFile(tagsPath);
				const tags = JSON.parse(tagsContent);
				const unique = new Set();
				tags.forEach((tag) => {
					LibraryTagKeys.forEach((key) => {
						if (tag[key]) {
							const label = String(tag[key]).trim();
							unique.add(JSON.stringify({ label, type: key }));
						}
					});
				});

				if (sessions) {
					const capitalize = (s) => {
						if (!s) return "";
						const str = String(s);
						if (str.toLowerCase() === "ai") return "AI";
						return str.charAt(0).toUpperCase() + str.slice(1);
					};
					sessions.forEach((session) => {
						if (session.group)
							unique.add(
								JSON.stringify({
									label: capitalize(session.group),
									type: "group",
								}),
							);
						if (session.year)
							unique.add(JSON.stringify({ label: session.year, type: "year" }));
						if (session.type)
							unique.add(
								JSON.stringify({
									label: capitalize(session.type),
									type: "type",
								}),
							);
					});
				}
				unique.add(
					JSON.stringify({
						label: translations.SESSIONS,
						type: "source",
						id: "SESSIONS",
					}),
				);
				unique.add(
					JSON.stringify({
						label: translations.ARTICLES,
						type: "source",
						id: "ARTICLES",
					}),
				);
				unique.add(
					JSON.stringify({
						label: translations.SUMMARIES,
						type: "source",
						id: "SUMMARIES",
					}),
				);

				if (isMounted.current) {
					const filters = Array.from(unique).map((s) => JSON.parse(s));
					filters.sort((a, b) => a.label.localeCompare(b.label));
					setAvailableFilters(filters);
					LibraryStore.update((s) => {
						s.tags = tags;
					});
				}
			}
		} catch (err) {
			structuredLogger.error("Failed to load tags for filters:", err);
		}
	}, [sessions, translations]);

	const buildIndex = useCallback(async () => {
		ResearchStore.update((s) => {
			s.indexing = true;
		});
	}, []);

	const loadIndex = useCallback(async () => {
		try {
			const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
			if (await storage.exists(indexPath)) {
				const content = await storage.readFile(indexPath);
				const data = decodeBinaryIndex(content);
				if (isMounted.current) {
					setIndexData(data);
				}
			} else {
				// Try legacy JSON format for migration
				const legacyPath = makePath(LIBRARY_LOCAL_PATH, LEGACY_INDEX_FILE);
				if (await storage.exists(legacyPath)) {
					const content = await storage.readFile(legacyPath);
					const data = JSON.parse(content);
					if (isMounted.current) {
						setIndexData(data);
					}
				} else {
					// Auto-build if not exists
					buildIndex();
				}
			}
		} catch (err) {
			structuredLogger.error("Failed to load search index:", err);
			// If the index is corrupted, delete it and rebuild
			try {
				const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
				if (await storage.exists(indexPath)) {
					await storage.deleteFile(indexPath);
					structuredLogger.debug(
						"Deleted corrupted search index, rebuilding...",
					);
					buildIndex();
				}
			} catch (deleteErr) {
				structuredLogger.error("Failed to delete corrupted index:", deleteErr);
			}
		}
	}, [buildIndex]);

	useEffect(() => {
		loadTags();
		loadIndex();
	}, [loadTags, loadIndex, indexTimestamp, sessions]);

	useEffect(() => {
		if (libraryUpdateCounter > 0) {
			loadIndex();
			loadTags();
		}
	}, [libraryUpdateCounter, loadIndex, loadTags, sessions]);

	const sessionsById = useMemo(() => {
		if (!sessions) {
			return new Map();
		}
		return sessions.reduce((map, session) => {
			const sessionId = `session|${session.group}|${session.year}|${session.date}|${session.name}`;
			map.set(sessionId, session);
			return map;
		}, new Map());
	}, [sessions]);

	const indexedTerms = useMemo(() => {
		const dictionary = indexData?.t || indexData?.tokens || {};
		return Object.keys(dictionary).slice(0, 5000);
	}, [indexData]);

	const suggestionTitles = useMemo(() => {
		const libraryTitles = (LibraryStore.getRawState().tags || []).map(
			(tag) => tag.title,
		);
		const sessionTitles = (sessions || []).map((session) => session.name);
		return [...new Set([...libraryTitles, ...sessionTitles].filter(Boolean))];
	}, [sessions, availableFilters]);

	const suggestions = useMemo(
		() =>
			getResearchSuggestions({
				query,
				filters: availableFilters,
				titles: suggestionTitles,
				terms: indexedTerms,
			}),
		[query, availableFilters, suggestionTitles, indexedTerms],
	);

	const handleSearch = useCallback(
		async (isRestoring = false, queryOverride) => {
			const requestId = ++searchRequestId.current;
			const searchQuery = queryOverride ?? query;
			setSuggestionsOpen(false);
			setActiveSuggestion(-1);
			setAppliedFilterTags(filterTags);
			if (!indexData || (!searchQuery.trim() && !filterTags.length)) {
				setResults([]);
				ResearchStore.update((s) => {
					s.hasSearched = true;
				});
				return;
			}

			setSearching(true);
			setSearchProgress(0);
			setShowProgress(false);
			if (progressHideTimer.current) {
				clearTimeout(progressHideTimer.current);
				progressHideTimer.current = null;
			}

			if (searchTimer.current) clearTimeout(searchTimer.current);
			searchTimer.current = setTimeout(() => {
				if (isMounted.current) setShowProgress(true);
			}, 1000);

			// Allow UI to update
			await new Promise((resolve) => setTimeout(resolve, 0));

			try {
				const {
					results: searchResults,
					highlight,
					cancelled,
				} = await runResearchSearch({
					indexData,
					searchQuery,
					sessionsById,
					libraryTags: LibraryStore.getRawState().tags,
					isCancelled: () =>
						!isMounted.current || requestId !== searchRequestId.current,
					onProgress: (progress) => {
						if (isMounted.current && requestId === searchRequestId.current) {
							setSearchProgress(progress);
						}
					},
				});

				if (
					cancelled ||
					!isMounted.current ||
					requestId !== searchRequestId.current
				) {
					return;
				}

				ResearchStore.update((s) => {
					s.results = searchResults;
					s.highlight = highlight;
					s.hasSearched = true;
				});
				if (!isRestoring && listRef.current) {
					listRef.current.scrollToItem(0, "start");
				}
			} catch (err) {
				structuredLogger.error("Search failed:", err);
			} finally {
				if (isMounted.current && requestId === searchRequestId.current) {
					setSearching(false);
					setSearchProgress(100);
					progressHideTimer.current = setTimeout(() => {
						if (isMounted.current && requestId === searchRequestId.current) {
							setShowProgress(false);
						}
						progressHideTimer.current = null;
					}, 500);
					if (searchTimer.current) {
						clearTimeout(searchTimer.current);
						searchTimer.current = null;
					}
				}
			}
		},
		[indexData, query, setResults, filterTags, sessionsById],
	);

	// Only auto-search on initial page load if there's a saved query from localStorage
	const initialSearchDone = useRef(false);
	const prevSessionCount = useRef(0);

	useEffect(() => {
		if (!_loaded) {
			return;
		}

		// If sessions updated (length changed), re-run search to ensure we have all results
		if (sessions && sessions.length !== prevSessionCount.current) {
			prevSessionCount.current = sessions.length;
			// Force re-search if we already ran one
			if (initialSearchDone.current && indexData) {
				handleSearch(true);
			}
		}

		if (initialSearchDone.current) {
			return;
		}
		// Trigger search if there's a query OR if there are filter tags
		if (!query && !filterTags.length) {
			initialSearchDone.current = true;
			return;
		}
		if (indexData) {
			initialSearchDone.current = true;
			if (!hasSearched && !searching) {
				handleSearch(true);
			}
		}
	}, [
		_loaded,
		indexData,
		hasSearched,
		searching,
		handleSearch,
		query,
		sessions,
		filterTags.length,
	]);

	const closeSuggestions = useCallback(() => {
		setSuggestionsOpen(false);
		setActiveSuggestion(-1);
	}, []);

	const handleClear = useCallback(() => {
		setQuery("");
		setFilterTags([]);
		setSource("all");
		setSuggestionsOpen(false);
		setActiveSuggestion(-1);
		ResearchStore.update((s) => {
			s.results = [];
			s.highlight = [];
			s.hasSearched = false;
		});
		setAppliedFilterTags([]);
	}, [setQuery, setFilterTags, setSource, setAppliedFilterTags]);

	const handleSuggestionSelect = useCallback(
		(suggestion) => {
			if (suggestion.kind === "filter") {
				if (
					!filterTags.some(
						(tag) =>
							tag.label === suggestion.filter.label &&
							tag.type === suggestion.filter.type,
					)
				) {
					setFilterTags([...filterTags, suggestion.filter]);
				}
			} else {
				setQuery(suggestion.value);
				handleSearch(false, suggestion.value);
			}
			setActiveSuggestion(-1);
			setSuggestionsOpen(false);
		},
		[filterTags, setFilterTags, setQuery, handleSearch],
	);

	const filterGroups = useMemo(() => {
		return availableFilters.reduce((groups, filter) => {
			(groups[filter.type] ||= []).push(filter);
			return groups;
		}, {});
	}, [availableFilters]);

	const visibleFilterGroups = useMemo(() => {
		const needle = filterListQuery.trim().toLowerCase();
		if (!needle) return filterGroups;
		return Object.fromEntries(
			Object.entries(filterGroups)
				.map(([type, filters]) => [
					type,
					filters.filter((filter) =>
						filter.label.toLowerCase().includes(needle),
					),
				])
				.filter(([, filters]) => filters.length > 0),
		);
	}, [filterGroups, filterListQuery]);

	const closeFilterDrawer = useCallback(() => {
		setFilterDrawerOpen(false);
		setFilterListQuery("");
	}, []);

	const toggleFilter = useCallback(
		(filter) => {
			const selected = filterTags.some(
				(tag) => tag.label === filter.label && tag.type === filter.type,
			);
			setFilterTags(
				selected
					? filterTags.filter(
							(tag) => tag.label !== filter.label || tag.type !== filter.type,
						)
					: [...filterTags, filter],
			);
		},
		[filterTags, setFilterTags],
	);

	const onKeyDown = (e) => {
		if (suggestionsOpen && suggestions.length) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				setActiveSuggestion((current) => {
					const direction = e.key === "ArrowDown" ? 1 : -1;
					return (
						(current + direction + suggestions.length) % suggestions.length
					);
				});
				return;
			}
			if (e.key === "Escape") {
				closeSuggestions();
				return;
			}
			if (e.key === "Enter" && activeSuggestion >= 0) {
				e.preventDefault();
				handleSuggestionSelect(suggestions[activeSuggestion]);
				return;
			}
		}
		if (e.key === "Enter") {
			handleSearch();
		}
	};

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

	const filteredResults = useMemo(() => {
		const scoped = results.filter((doc) => {
			if (source === "articles") return !doc.isSession;
			if (source === "sessions") return doc.isSession;
			return true;
		});
		return filterResearchResults(scoped, appliedFilterTags, translations);
	}, [results, appliedFilterTags, translations, source]);

	const pathItems = usePathItems();

	const matchCounts = useMemo(() => {
		let sum = 0;
		return filteredResults.map((doc) => {
			const count = doc.matches?.length || 0;
			const start = sum + 1;
			sum += count;
			return { start, count, total: sum };
		});
	}, [filteredResults]);

	const totalMatches =
		matchCounts.length > 0 ? matchCounts[matchCounts.length - 1].total : 0;

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
				// "Paragraph" in Research context is "Match number" across all results
				const matchIndex = value;
				const docIndex = matchCounts.findIndex(
					(m) => matchIndex >= m.start && matchIndex <= m.total,
				);
				if (docIndex !== -1) {
					listRef.current.scrollToItem(docIndex, "start");
					// Also scroll within the article if needed
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
		[filteredResults, matchCounts],
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
	}, [pathItems, filteredResults]);

	const getItemSize = useCallback(
		(index) => {
			if (rowHeights.current[index]) return rowHeights.current[index];
			const doc = filteredResults[index];
			const matchCount = doc?.matches?.length || 1;
			// More generous initial estimate to avoid initial clipping
			return 400 + matchCount * 200;
		},
		[filteredResults],
	);

	useEffect(() => {
		rowHeights.current = {};
		if (listRef.current) {
			listRef.current.resetAfterIndex(0);
		}
	}, [filteredResults]);

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

			// Align immediately, then again after measured heights settle.
			scrollToResult();
			requestAnimationFrame(scrollToResult);
			const realignTimer = setTimeout(scrollToResult, 250);
			jumpTimeout.current = setTimeout(() => {
				clearTimeout(realignTimer);
				isJumping.current = false;
			}, 1000);
		},
		[closeResultsOutline],
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

	const toolbarItems = useMemo(
		() => [
			{
				id: "toggleSearch",
				name: searchCollapsed
					? translations.SHOW_SEARCH
					: translations.HIDE_SEARCH,
				active: !searchCollapsed,
				icon: <SearchIcon />,
				onClick: () => setSearchCollapsed((prev) => !prev),
				location: "header",
			},
			isAdmin && {
				id: "rebuildIndex",
				name: translations.REBUILD_INDEX,
				icon: <RefreshIcon />,
				onClick: buildIndex,
				disabled: indexing,
				location: "header",
			},
			{
				id: "jump",
				name: translations.JUMP_TO_ARTICLE,
				icon: <FormatListNumberedIcon />,
				onClick: () => setJumpOpen(true),
				location: "header",
			},
			{
				id: "print",
				name: translations.PRINT,
				icon: <PrintIcon />,
				onClick: handlePrint,
				location: "header",
			},
		],
		[translations, buildIndex, indexing, searchCollapsed, handlePrint, isAdmin],
	);

	useToolbar({ id: "Research", items: toolbarItems, depends: [toolbarItems] });

	const panelToggleLabel = searchCollapsed
		? translations.SHOW_SEARCH || "Show Search"
		: translations.HIDE_SEARCH || "Hide Search";

	const collapsedSearchSummary = [
		query.trim() || translations.RESEARCH || "Research",
		filterTags.length
			? `${filterTags.length} ${translations.FILTERS || "Filters"}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Box className={styles.root}>
			{searchCollapsed ? (
				<Paper className={styles.searchPaperCollapsed}>
					<Box className={styles.collapsedSearchBar}>
						<Typography
							variant="body2"
							className={styles.collapsedSearchSummary}
							noWrap
						>
							{collapsedSearchSummary}
						</Typography>
						<Tooltip title={panelToggleLabel}>
							<IconButton
								size="small"
								className={styles.panelToggle}
								onClick={() => setSearchCollapsed(false)}
								aria-expanded={false}
								aria-label={panelToggleLabel}
							>
								<ExpandMoreIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Paper>
			) : (
				<Paper className={styles.searchPaper}>
					<Box className={styles.searchIntro}>
						<Box className={styles.searchIntroText}>
							<Typography variant="h5">
								{translations.RESEARCH || "Research"}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{translations.RESEARCH_HELP ||
									"Search your articles, sessions, and summaries."}
							</Typography>
						</Box>
						<Tooltip title={panelToggleLabel}>
							<IconButton
								size="small"
								className={clsx(styles.panelToggle, styles.panelToggleExpanded)}
								onClick={() => setSearchCollapsed(true)}
								aria-expanded={true}
								aria-label={panelToggleLabel}
							>
								<ExpandMoreIcon />
							</IconButton>
						</Tooltip>
					</Box>
					<Tabs
						value={source}
						onChange={(_event, value) => setSource(value)}
						className={styles.sourceTabs}
					>
						<Tab value="all" label={translations.ALL || "All"} />
						<Tab value="articles" label={translations.ARTICLES || "Articles"} />
						<Tab value="sessions" label={translations.SESSIONS || "Sessions"} />
					</Tabs>
					<Box className={styles.searchHeader}>
						<ClickAwayListener
							className={styles.queryWrap}
							onClickAway={closeSuggestions}
						>
							<div data-research-query className={styles.queryField}>
								<TextField
									fullWidth
									placeholder={translations.SEARCH_ARTICLES}
									value={query}
									onChange={(e) => {
										setQuery(e.target.value);
										setSuggestionsOpen(true);
										setActiveSuggestion(-1);
									}}
									onFocus={() => setSuggestionsOpen(true)}
									onBlur={(event) => {
										const wrap = event.currentTarget.closest(
											"[data-research-query]",
										);
										if (wrap?.contains(event.relatedTarget)) {
											return;
										}
										closeSuggestions();
									}}
									onKeyDown={onKeyDown}
									variant="outlined"
									inputProps={{
										role: "combobox",
										"aria-autocomplete": "list",
										"aria-controls":
											suggestionsOpen && suggestions.length > 0
												? "research-suggestions"
												: undefined,
										"aria-expanded": suggestionsOpen && suggestions.length > 0,
										"aria-activedescendant":
											activeSuggestion >= 0
												? `research-suggestion-${activeSuggestion}`
												: undefined,
									}}
									startAdornment={
										<InputAdornment position="start">
											<SearchIcon />
										</InputAdornment>
									}
									endAdornment={
										query ? (
											<InputAdornment position="end">
												<IconButton
													aria-label={translations.CLEAR || "Clear search"}
													onClick={handleClear}
													size="small"
												>
													<ClearIcon fontSize="small" />
												</IconButton>
											</InputAdornment>
										) : null
									}
								/>
								{suggestionsOpen && suggestions.length > 0 && (
									<Paper
										id="research-suggestions"
										className={styles.suggestions}
										role="listbox"
									>
										{suggestions.map((suggestion, index) => (
											<Button
												id={`research-suggestion-${index}`}
												key={`${suggestion.kind}-${suggestion.label}`}
												role="option"
												aria-selected={activeSuggestion === index}
												tabIndex={-1}
												className={
													activeSuggestion === index
														? styles.suggestionActive
														: styles.suggestion
												}
												variant="text"
												onMouseDown={(event) => event.preventDefault()}
												onClick={() => handleSuggestionSelect(suggestion)}
											>
												<Typography variant="caption">
													{translations[
														`SUGGESTION_${suggestion.kind.toUpperCase()}`
													] || suggestion.kind}
												</Typography>
												{suggestion.label}
											</Button>
										))}
									</Paper>
								)}
							</div>
						</ClickAwayListener>
						<Badge variant="dot" invisible={!filterTags.length}>
							<Button
								variant="outlined"
								onClick={() => setFilterDrawerOpen(true)}
								className={styles.filterButton}
								startIcon={<FilterAltIcon />}
							>
								{`${translations.FILTERS || "Filters"}${filterTags.length ? ` (${filterTags.length})` : ""}`}
							</Button>
						</Badge>
						<Button
							variant="contained"
							onClick={handleSearch}
							disabled={indexing || searching || !indexData}
							className={styles.searchButton}
						>
							{translations.SEARCH}
						</Button>
					</Box>
					<Typography variant="caption" className={styles.searchHint}>
						{translations.SEARCH_HINT ||
							"Use quotes for a phrase; use AND or OR to refine a search."}
					</Typography>
					{filterTags.length > 0 && (
						<Box className={styles.activeFilters}>
							{filterTags.map((tag) => (
								<Chip
									key={`${tag.type}-${tag.label}`}
									label={`${translations[tag.type?.toUpperCase()] || tag.type}: ${tag.label}`}
									onDelete={() => toggleFilter(tag)}
									size="small"
								/>
							))}
							<Button variant="text" onClick={() => setFilterTags([])}>
								{translations.CLEAR_ALL || "Clear all"}
							</Button>
						</Box>
					)}
				</Paper>
			)}
			<Drawer
				open={filterDrawerOpen}
				onClose={closeFilterDrawer}
				anchor="right"
				className={styles.filterDrawer}
			>
				<Box className={styles.drawerContent}>
					<Box className={styles.drawerHeader}>
						<Typography variant="h6">
							{translations.FILTERS || "Filters"}
						</Typography>
						<IconButton
							aria-label={translations.CLOSE || "Close"}
							onClick={closeFilterDrawer}
						>
							<ClearIcon />
						</IconButton>
					</Box>
					<TextField
						fullWidth
						variant="outlined"
						className={styles.filterSearch}
						placeholder={translations.SEARCH_FILTERS || "Search filters..."}
						value={filterListQuery}
						onChange={(e) => setFilterListQuery(e.target.value)}
						startAdornment={
							<InputAdornment position="start">
								<SearchIcon />
							</InputAdornment>
						}
						endAdornment={
							filterListQuery ? (
								<InputAdornment position="end">
									<IconButton
										aria-label={translations.CLEAR || "Clear search"}
										onClick={() => setFilterListQuery("")}
										size="small"
									>
										<ClearIcon fontSize="small" />
									</IconButton>
								</InputAdornment>
							) : null
						}
					/>
					{Object.entries(visibleFilterGroups).map(([type, filters]) => (
						<Box key={type} className={styles.filterGroup}>
							<Typography variant="caption" className={styles.filterGroupTitle}>
								{translations[type.toUpperCase()] || type}
							</Typography>
							<List disablePadding className={styles.filterChoices}>
								{filters.map((filter) => {
									const selected = filterTags.some(
										(tag) =>
											tag.label === filter.label &&
											tag.type === filter.type,
									);
									return (
										<ListItem
											key={`${filter.type}-${filter.label}`}
											disablePadding
										>
											<ListItemButton
												selected={selected}
												onClick={() => toggleFilter(filter)}
											>
												<ListItemText primary={filter.label} />
											</ListItemButton>
										</ListItem>
									);
								})}
							</List>
						</Box>
					))}
					<Box className={styles.drawerActions}>
						<Button variant="text" onClick={() => setFilterTags([])}>
							{translations.CLEAR_ALL || "Clear all"}
						</Button>
						<Button variant="contained" onClick={closeFilterDrawer}>
							{translations.DONE || "Done"}
						</Button>
					</Box>
				</Box>
			</Drawer>
			{showProgress && (
				<Box className={styles.progressContainer}>
					<Typography variant="caption">{translations.SEARCHING}</Typography>
					<LinearProgress variant="determinate" value={searchProgress} />
				</Box>
			)}
			{indexing && (
				<Box className={styles.overlay}>
					<Paper className={styles.overlayContent}>
						<Typography variant="h6" gutterBottom>
							{status || translations.INDEXING}
						</Typography>
						<Box className={styles.indexProgressRow}>
							<Box className={styles.indexProgressBar}>
								<LinearProgress variant="determinate" value={progress} />
							</Box>
							<Box className={styles.indexProgressLabel}>
								<Typography
									variant="body2"
									color="text.secondary"
								>{`${Math.round(progress)}%`}</Typography>
							</Box>
						</Box>
					</Paper>
				</Box>
			)}
			{!hasSearched && !indexing && !indexData && (
				<Box className={styles.noResults}>
					<Typography variant="h6">
						{translations.RESEARCH_PREPARING || "Preparing Research"}
					</Typography>
					<Typography variant="body2">
						{translations.RESEARCH_INDEX_HELP ||
							"Your local library index is being prepared. Search will be available when it is ready."}
					</Typography>
				</Box>
			)}
			{!hasSearched && !indexing && indexData && (
				<Box className={styles.noResults}>
					<Typography variant="h6">
						{translations.RESEARCH_START || "Find ideas across your library"}
					</Typography>
					<Typography variant="body2">
						{translations.RESEARCH_START_HELP ||
							"Search by a word, a phrase, or use filters to narrow your research."}
					</Typography>
				</Box>
			)}
			{hasSearched && filteredResults.length === 0 && !indexing && (
				<Box className={styles.noResults}>
					<Typography variant="h6">{translations.NO_RESULTS}</Typography>
					<Typography variant="body2">
						{translations.NO_RESULTS_HELP ||
							"Try a different word, remove a filter, or search a shorter phrase."}
					</Typography>
					{filterTags.length > 0 && (
						<Button variant="text" onClick={() => setFilterTags([])}>
							{translations.CLEAR_FILTERS || "Clear filters"}
						</Button>
					)}
				</Box>
			)}
			{hasSearched && filteredResults.length > 0 && (
				<Box className={styles.resultsWrapper}>
					<Box className={styles.resultsSummary}>
						<Typography variant="body2">{`${filteredResults.length} ${filteredResults.length === 1 ? translations.RESULT || "result" : translations.RESULTS || "results"} · ${totalMatches} ${translations.MATCH || "matches"}`}</Typography>
					</Box>
					<Box ref={listContainerRef} className={styles.listContainer}>
						<VariableSizeList
							height={Math.max(1, listSize.height)}
							itemCount={filteredResults.length}
							itemSize={getItemSize}
							width={Math.max(1, listSize.width || size.width - 32)}
							ref={listRef}
							outerRef={outerRef}
							onItemsRendered={({ visibleStartIndex }) => {
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
							}}
							itemData={itemData}
						>
							{SearchResultItem}
						</VariableSizeList>
					</Box>
					<ScrollToTop
						show={showScrollTop}
						onClick={scrollToTop}
						translations={translations}
					/>
					<PageIndicator
						current={scrollPages.page}
						total={scrollPages.count}
						visible={scrollPages.visible || resultsOutlineOpen}
						translations={translations}
						label={translations.ARTICLE}
						onClick={
							filteredResults.length > 0 ? openResultsOutline : undefined
						}
					/>
					<ResultsOutline
						open={resultsOutlineOpen}
						anchorEl={resultsOutlineAnchor}
						onClose={closeResultsOutline}
						results={filteredResults}
						currentIndex={Math.max(0, scrollPages.page - 1)}
						onSelect={handleResultsOutlineSelect}
						translations={translations}
					/>
				</Box>
			)}
			<JumpDialog
				open={jumpOpen}
				onClose={() => setJumpOpen(false)}
				onSubmit={handleJumpSubmit}
				maxPage={filteredResults.length}
				maxParagraphs={totalMatches}
				pageLabel={translations.ARTICLE}
				pageNumberLabel={translations.ARTICLE_NUMBER}
				paragraphLabel={translations.MATCH}
				paragraphNumberLabel={translations.MATCH_NUMBER}
				title={translations.JUMP_TO_ARTICLE}
			/>
			{printRoot &&
				createPortal(
					<div className={styles.printContainer}>
						{printing &&
							filteredResults.map((doc, index) => (
								<div key={doc.docId || index} className={styles.printItem}>
									<Article
										selectedTag={doc.tag}
										content={
											doc.text
												? normalizeContent(doc.text)
												: doc.paragraphs
													? doc.paragraphs.join("\n\n")
													: ""
										}
										filteredParagraphs={
											doc.matches?.map((m) => m.index + 1) || []
										}
										embedded={true}
										hidePlayer={true}
										highlight={highlight}
									/>
								</div>
							))}
					</div>,
					printRoot,
				)}
		</Box>
	);
}
