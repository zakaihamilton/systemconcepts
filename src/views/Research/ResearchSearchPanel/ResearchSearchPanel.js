import ClearIcon from "@icons/svg/Clear.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import FilterAltIcon from "@icons/svg/FilterAlt.svg";
import SearchIcon from "@icons/svg/Search.svg";
import Badge from "@ui/Badge";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Chip from "@ui/Chip";
import ClickAwayListener from "@ui/ClickAwayListener";
import IconButton from "@ui/IconButton";
import InputAdornment from "@ui/InputAdornment";
import Paper from "@ui/Paper";
import { Tab, Tabs } from "@ui/Tabs";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import { LibraryStore } from "@views/Library/Store";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../Research.module.css";
import { getResearchSuggestions } from "../searchQuery";

export default function ResearchSearchPanel({
	searchCollapsed,
	setSearchCollapsed,
	query,
	setQuery,
	filterTags,
	setFilterTags,
	source,
	setSource,
	availableFilters,
	indexedTerms,
	sessions,
	indexing,
	searching,
	indexData,
	handleSearch,
	handleClear,
	translations,
	onOpenFilters,
	onToggleFilter,
	suggestionControlsRef,
}) {
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [activeSuggestion, setActiveSuggestion] = useState(-1);

	useEffect(() => {
		if (!suggestionControlsRef) return;
		suggestionControlsRef.current = {
			setSuggestionsOpen,
			setActiveSuggestion,
		};
	}, [suggestionControlsRef]);

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

	const closeSuggestions = useCallback(() => {
		setSuggestionsOpen(false);
		setActiveSuggestion(-1);
	}, []);

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

	if (searchCollapsed) {
		return (
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
		);
	}

	return (
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
						onClick={onOpenFilters}
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
							onDelete={() => onToggleFilter(tag)}
							size="small"
						/>
					))}
					<Button variant="text" onClick={() => setFilterTags([])}>
						{translations.CLEAR_ALL || "Clear all"}
					</Button>
				</Box>
			)}
		</Paper>
	);
}
