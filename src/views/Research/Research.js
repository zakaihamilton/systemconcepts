import { ContentSize } from "@components/Page/Content";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import FormatListNumberedIcon from "@icons/svg/FormatListNumbered.svg";
import PrintIcon from "@icons/svg/Print.svg";
import RefreshIcon from "@icons/svg/Refresh.svg";
import SearchIcon from "@icons/svg/Search.svg";
import Box from "@ui/Box";
import Button from "@ui/Button";
import LinearProgress from "@ui/LinearProgress";
import Paper from "@ui/Paper";
import Typography from "@ui/Typography";
import { roleAuth } from "@util/auth/roles";
import { useDeviceType } from "@util/browser/styles";
import { normalizeContent } from "@util/data/string";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Article from "@views/Library/Article";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
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
import ResearchFilterDrawer from "./ResearchFilterDrawer";
import ResearchResultsList from "./ResearchResultsList";
import ResearchSearchPanel from "./ResearchSearchPanel";
import styles from "./Research.module.css";
import {
	filterResearchResults,
	sanitizeResearchFilterTags,
} from "./searchFilters";
import { useResearchIndex } from "./useResearchIndex";
import { useResearchSearch } from "./useResearchSearch";

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
	const {
		indexData,
		availableFilters,
		sessionsById,
		indexedTerms,
		buildIndex,
	} = useResearchIndex({
		sessions,
		translations,
		indexTimestamp,
	});
	const size = useContext(ContentSize);
	const listRef = useRef();
	const deviceType = useDeviceType();
	const isMobile = deviceType !== "desktop";
	const [searchCollapsed, setSearchCollapsed] = useState(false);
	const [jumpOpen, setJumpOpen] = useState(false);
	const [printing, setPrinting] = useState(false);
	const [printRoot, setPrintRoot] = useState(null);
	const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
	const suggestionControlsRef = useRef(null);
	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

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

	const {
		searching,
		searchProgress,
		showProgress,
		appliedFilterTags,
		setAppliedFilterTags,
		handleSearch,
	} = useResearchSearch({
		indexData,
		query,
		filterTags,
		sessionsById,
		translations,
		hasSearched,
		_loaded,
		sessions,
		listRef,
		setResults,
		setSuggestionsOpen: (open) =>
			suggestionControlsRef.current?.setSuggestionsOpen(open),
		setActiveSuggestion: (index) =>
			suggestionControlsRef.current?.setActiveSuggestion(index),
	});

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

	// Drop retired Transcriptions filters restored from localStorage.
	useEffect(() => {
		if (!_loaded) return;
		const cleaned = sanitizeResearchFilterTags(filterTags, translations);
		if (cleaned.length === filterTags.length) return;
		setFilterTags(cleaned);
		setAppliedFilterTags((prev) =>
			sanitizeResearchFilterTags(prev, translations),
		);
	}, [_loaded, filterTags, translations, setFilterTags, setAppliedFilterTags]);

	const handleClear = useCallback(() => {
		setQuery("");
		setFilterTags([]);
		setSource("all");
		suggestionControlsRef.current?.setSuggestionsOpen(false);
		suggestionControlsRef.current?.setActiveSuggestion(-1);
		ResearchStore.update((s) => {
			s.results = [];
			s.highlight = [];
			s.hasSearched = false;
		});
		setAppliedFilterTags([]);
	}, [setQuery, setFilterTags, setSource, setAppliedFilterTags]);

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

	const filteredResults = useMemo(() => {
		const scoped = results.filter((doc) => {
			if (source === "articles") return !doc.isSession;
			if (source === "sessions") return doc.isSession;
			return true;
		});
		return filterResearchResults(scoped, appliedFilterTags, translations);
	}, [results, appliedFilterTags, translations, source]);

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

	return (
		<Box className={styles.root}>
			<ResearchSearchPanel
				searchCollapsed={searchCollapsed}
				setSearchCollapsed={setSearchCollapsed}
				query={query}
				setQuery={setQuery}
				filterTags={filterTags}
				setFilterTags={setFilterTags}
				source={source}
				setSource={setSource}
				availableFilters={availableFilters}
				indexedTerms={indexedTerms}
				sessions={sessions}
				indexing={indexing}
				searching={searching}
				indexData={indexData}
				handleSearch={handleSearch}
				handleClear={handleClear}
				translations={translations}
				onOpenFilters={() => setFilterDrawerOpen(true)}
				onToggleFilter={toggleFilter}
				suggestionControlsRef={suggestionControlsRef}
			/>
			<ResearchFilterDrawer
				open={filterDrawerOpen}
				onClose={() => setFilterDrawerOpen(false)}
				filterTags={filterTags}
				availableFilters={availableFilters}
				translations={translations}
				setFilterTags={setFilterTags}
				onToggleFilter={toggleFilter}
			/>
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
			<ResearchResultsList
				filteredResults={filteredResults}
				highlight={highlight}
				matchCounts={matchCounts}
				totalMatches={totalMatches}
				hasSearched={hasSearched}
				filterDrawerOpen={filterDrawerOpen}
				translations={translations}
				searchCollapsed={searchCollapsed}
				setSearchCollapsed={setSearchCollapsed}
				isMobile={isMobile}
				jumpOpen={jumpOpen}
				setJumpOpen={setJumpOpen}
				contentWidth={size.width}
				listRef={listRef}
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
