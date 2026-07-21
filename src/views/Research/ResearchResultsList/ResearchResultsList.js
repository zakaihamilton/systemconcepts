import VariableSizeList from "@components/Virtualized/VariableSizeList";
import Box from "@ui/Box";
import Typography from "@ui/Typography";
import JumpDialog from "@views/Library/Article/JumpDialog";
import ScrollToTop from "@views/Library/Article/ScrollToTop";
import PageIndicator from "../PageIndicator";
import styles from "../Research.module.css";
import ResultsOutline from "../ResultsOutline";
import SearchResultItem from "../SearchResultItem";
import { useResearchResultsList } from "./useResearchResultsList";

export default function ResearchResultsList({
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
	const {
		listContainerRef,
		outerRef,
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
		handleItemsRendered,
		listWidth,
		listHeight,
		jumpDialogProps,
	} = useResearchResultsList({
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
	});

	return (
		<>
			{hasSearched && filteredResults.length > 0 && (
				<Box className={styles.resultsWrapper}>
					<Box className={styles.resultsSummary}>
						<Typography variant="body2">{`${filteredResults.length} ${filteredResults.length === 1 ? translations.RESULT || "result" : translations.RESULTS || "results"} · ${totalMatches} ${translations.MATCH || "matches"}`}</Typography>
					</Box>
					<Box ref={listContainerRef} className={styles.listContainer}>
						<VariableSizeList
							height={listHeight}
							itemCount={filteredResults.length}
							itemSize={getItemSize}
							width={listWidth}
							ref={listRef}
							outerRef={outerRef}
							onItemsRendered={handleItemsRendered}
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
						visible={
							!filterDrawerOpen && (scrollPages.visible || resultsOutlineOpen)
						}
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
			<JumpDialog {...jumpDialogProps} />
		</>
	);
}
