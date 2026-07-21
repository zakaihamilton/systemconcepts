import { logger as structuredLogger } from "@util/api/logger";
import { LibraryStore } from "@views/Library/Store";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { runResearchSearch } from "./runResearchSearch";

/**
 * Owns research search lifecycle: execution, progress, cancellation, and restore.
 * @param {{
 *   indexData: unknown,
 *   query: string,
 *   filterTags: unknown[],
 *   sessionsById: Map<string, unknown>,
 *   translations: Record<string, string>,
 *   hasSearched: boolean,
 *   _loaded: boolean,
 *   sessions: unknown[] | null | undefined,
 *   listRef: React.MutableRefObject<unknown>,
 *   setResults: (val: unknown) => void,
 *   setSuggestionsOpen?: (open: boolean) => void,
 *   setActiveSuggestion?: (index: number) => void,
 * }} params
 */
export function useResearchSearch({
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
	setSuggestionsOpen,
	setActiveSuggestion,
}) {
	const [searching, setSearching] = useState(false);
	const [searchProgress, setSearchProgress] = useState(0);
	const [showProgress, setShowProgress] = useState(false);
	const [appliedFilterTags, setAppliedFilterTags] = useState(
		hasSearched ? filterTags : [],
	);
	const searchTimer = useRef(null);
	const progressHideTimer = useRef(null);
	const searchRequestId = useRef(0);
	const isMounted = useRef(true);
	const initialSearchDone = useRef(false);
	const prevSessionCount = useRef(0);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
			if (progressHideTimer.current) {
				clearTimeout(progressHideTimer.current);
			}
		};
	}, []);

	const handleSearch = useCallback(
		async (isRestoring = false, queryOverride) => {
			const requestId = ++searchRequestId.current;
			const searchQuery = queryOverride ?? query;
			setSuggestionsOpen?.(false);
			setActiveSuggestion?.(-1);
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
					filterTags,
					translations,
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
		[
			indexData,
			query,
			setResults,
			filterTags,
			sessionsById,
			translations,
			listRef,
			setSuggestionsOpen,
			setActiveSuggestion,
		],
	);

	// Only auto-search on initial page load if there's a saved query from localStorage
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

	return {
		searching,
		searchProgress,
		showProgress,
		appliedFilterTags,
		setAppliedFilterTags,
		handleSearch,
	};
}
