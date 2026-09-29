import { useSearch } from "@components/Search";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import LibraryBooksIcon from "@icons/svg/LibraryBooks.svg";
import Box from "@ui/Box";
import CircularProgress from "@ui/CircularProgress";
import Typography from "@ui/Typography";
import { roleAuth } from "@util/auth/roles";
import { useLocalStorage } from "@util/browser/hooks";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import Cookies from "js-cookie";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { LibraryTagKeys } from "../Icons";
import { LibraryStore } from "../Store";
import styles from "./Article.module.css";
import ArticleTermsDialog from "./ArticleTermsDialog";
import Content from "./Content";
import { replaceAbbreviations, scanForTerms } from "./GlossaryUtils";
import Header from "./Header";
import JumpDialog from "./JumpDialog";
import PageIndicator from "./PageIndicator";
import Player from "./Player";
import ScrollToTop from "./ScrollToTop";
import { useArticlePrint } from "./useArticlePrint";
import { useArticleScroll } from "./useArticleScroll";
import { useArticleSearch } from "./useArticleSearch";
import { useArticleToolbarItems } from "./useArticleToolbarItems";

registerToolbar("Article");

/**
 * ArticleToolbar Component
 * Handles global toolbar registration for the Article page.
 * Rendered only when the article is NOT embedded.
 */
function ArticleToolbar({ id, items, visible, depends }: any) {
	useToolbar({ id, items, visible, depends });
	return null;
}

function Article({
	selectedTag,
	content,
	openEditDialog,
	openEditContentDialog,
	loading,

	prevArticle,
	nextArticle,
	onPrev,
	onNext,
	filteredParagraphs = null,
	onTitleClick,
	embedded,
	hidePlayer,
	hideHeader,
	hideContent,
	highlight,
	customTags,
}: any) {
	const translations = useTranslations();
	const search = useSearch("default", null, !embedded);
	const contentRef = useRef<any>(null);
	const [isHeaderHidden, setIsHeaderHidden] = useState(false);

	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	const handleScroll = useCallback(
		(e: any) => {
			const scrollTop = e.target.scrollTop;
			const shouldHide = isHeaderHidden ? scrollTop > 100 : scrollTop > 150;
			if (shouldHide !== isHeaderHidden) {
				setIsHeaderHidden(shouldHide);
			}
		},
		[isHeaderHidden],
	);

	const deviceType = useDeviceType();
	const isMobile = deviceType !== "desktop";
	const isPhone = deviceType === "phone";
	const [showPlaceholder, setShowPlaceholder] = useState(false);
	const [showMarkdown, setShowMarkdown] = useState(true);
	const [showAbbreviations, setShowAbbreviations] = useLocalStorage(
		"showAbbreviations",
		true,
	);
	const [hideSquareBrackets, setHideSquareBrackets] = useLocalStorage(
		"hideSquareBrackets",
		false,
	);
	const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
	const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
	const [termsDialogOpen, setTermsDialogOpen] = useState(false);
	const [articleTerms, setArticleTerms] = useState<any[]>([]);
	const [totalParagraphs, setTotalParagraphs] = useState(0);

	const {
		scrollInfo,
		setScrollInfo,
		showScrollTop,
		handleScrollUpdate,
		scrollToTop,
	} = useArticleScroll(contentRef, handleScroll, embedded);

	// Reset scroll position when article changes
	useEffect(() => {
		if (selectedTag) {
			setIsHeaderHidden(false);
			if (contentRef.current) {
				contentRef.current.scrollTop = 0;
			}
		}
	}, [selectedTag?._id, contentRef]); // eslint-disable-line react-hooks/exhaustive-deps

	const { matchIndex, totalMatches, handleNextMatch, handlePrevMatch } =
		useArticleSearch(content, search);

	const handleJump = useCallback(
		(type: any, value: any) => {
			setJumpDialogOpen(false);
			setTimeout(() => {
				if (!contentRef.current) return;
				contentRef.current.focus();
				if (type === "paragraph") {
					let element = contentRef.current.querySelector(
						`[data-paragraph-index="${value}"]`,
					);
					if (!element) {
						// Fallback: search for element containing the paragraph index in its span
						const elements = contentRef.current.querySelectorAll(
							"[data-paragraph-index]",
						);
						for (const el of elements) {
							const index = parseInt(
								el.getAttribute("data-paragraph-index"),
								10,
							);
							const span = parseInt(
								el.getAttribute("data-paragraph-span") || "1",
								10,
							);
							if (value >= index && value < index + span) {
								element = el;
								break;
							}
						}
					}

					if (element) {
						setCurrentParagraphIndex(value);
						element.scrollIntoView({ behavior: "smooth", block: "center" });
						element.classList.add(styles.highlightedParagraph);
						setTimeout(() => {
							element.classList.remove(styles.highlightedParagraph);
						}, 2000);
					}
				} else if (type === "page") {
					if (scrollInfo.clientHeight > 0) {
						const scrollTop = (value - 1) * scrollInfo.clientHeight;
						contentRef.current.scrollTo({ top: scrollTop, behavior: "smooth" });
					}
				}
			}, 100);
		},
		[contentRef, scrollInfo.clientHeight],
	);

	const title = useMemo(() => {
		if (!selectedTag) return { name: "", key: "" };
		for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
			const key = LibraryTagKeys[i];
			const value = selectedTag[key];
			if (value && String(value).trim()) {
				return { name: value, key };
			}
		}
		return { name: "", key: "" };
	}, [selectedTag]);

	const processedContent = useMemo(() => {
		if (!content) return content;
		let result = content;
		if (!showAbbreviations) {
			result = replaceAbbreviations(result);
		}
		if (hideSquareBrackets) {
			result = result.replace(/\[([^\]]*)\](?![\(\[])/g, "");
		}
		return result;
	}, [content, showAbbreviations, hideSquareBrackets]);

	const handleShowTerms = useCallback(() => {
		const terms = scanForTerms(processedContent);
		setArticleTerms(terms);
		setTermsDialogOpen(true);
	}, [processedContent]);

	// Handle scroll to paragraph from cross-link navigation
	const scrollToParagraph = LibraryStore.useState((s) => s.scrollToParagraph);
	useEffect(() => {
		if (scrollToParagraph !== null && content) {
			setTimeout(() => {
				handleJump("paragraph", scrollToParagraph);
				LibraryStore.update((s) => {
					s.scrollToParagraph = null;
				});
			}, 500);
		}
	}, [scrollToParagraph, content, handleJump]);

	useEffect(() => {
		const element = contentRef.current;
		if (!element) return;

		const paragraphs = element.querySelectorAll("[data-paragraph-index]");
		const count = paragraphs.length;
		setTotalParagraphs((prev) => (prev !== count ? count : prev));
	}, [content, contentRef]);

	const handleClick = useCallback((e: any) => {
		if (e.target.closest("a") || e.target.closest("[data-prevent-select]")) {
			return;
		}

		const paragraph = e.target.closest("[data-paragraph-index]");
		if (paragraph) {
			const index = paragraph.getAttribute("data-paragraph-index");
			if (index) {
				setCurrentParagraphIndex(parseInt(index, 10));
				const currentHash = window.location.hash;
				const separatorIndex = currentHash.lastIndexOf(":");
				const lastSlashIndex = currentHash.lastIndexOf("/");
				let newHash = currentHash;

				if (separatorIndex !== -1 && separatorIndex > lastSlashIndex) {
					const suffix = currentHash.substring(separatorIndex + 1);
					if (/^\d+$/.test(suffix)) {
						newHash = currentHash.substring(0, separatorIndex) + ":" + index;
					} else {
						newHash = currentHash + ":" + index;
					}
				} else {
					newHash = currentHash + ":" + index;
				}

				if (currentHash !== newHash) {
					window.history.replaceState(null, "", newHash);
				}
			}
		}
	}, []);

	useEffect(() => {
		if (!content && !selectedTag) {
			const timer = setTimeout(() => {
				setShowPlaceholder(true);
			}, 300);
			return () => clearTimeout(timer);
		} else {
			setTimeout(() => setShowPlaceholder(false), 0);
		}
	}, [content, selectedTag]);

	useEffect(() => {
		setTimeout(
			() =>
				setScrollInfo({
					page: 1,
					total: 1,
					visible: false,
					clientHeight: 0,
					scrollHeight: 0,
				}),
			0,
		);
	}, [selectedTag?._id, setScrollInfo]);

	const { handlePrint, handleExport } = useArticlePrint({
		contentRef,
		selectedTag,
		content,
	});

	const toolbarItems = useArticleToolbarItems({
		translations,
		handleExport,
		handlePrint,
		isAdmin,
		openEditDialog,
		openEditContentDialog,
		search,
		totalMatches,
		matchIndex,
		handlePrevMatch,
		handleNextMatch,
		showMarkdown,
		setShowMarkdown,
		content,
		selectedTag,
		isPhone,
		handleShowTerms,
		showAbbreviations,
		setShowAbbreviations,
		hideSquareBrackets,
		setHideSquareBrackets,
		setJumpDialogOpen,
		prevArticle,
		nextArticle,
		onPrev,
		onNext,
		isMobile,
		embedded,
	});

	const swipeHandlers = useSwipe({
		onSwipeLeft: onNext,
		onSwipeRight: onPrev,
	});

	if (loading) {
		return (
			<Box component="main" className={clsx(styles.root, styles.centeredState)}>
				<CircularProgress />
			</Box>
		);
	}

	if (!selectedTag && !content && showPlaceholder) {
		return (
			<Box component="main" className={clsx(styles.root, styles.centeredState)}>
				<Box className={styles.placeholder}>
					<LibraryBooksIcon />
					<Typography component="p">{translations.SELECT_ITEM}</Typography>
				</Box>
			</Box>
		);
	}

	if (!content && !selectedTag) return null;

	return (
		<Box
			component="main"
			className={clsx(
				styles.root,
				styles.articleMain,
				embedded && styles.embedded,
			)}
			minWidth={0}
			{...swipeHandlers}
		>
			{!embedded && (
				<ArticleToolbar
					id="Article"
					items={toolbarItems}
					visible={!!content}
					depends={[toolbarItems, content]}
				/>
			)}
			<ScrollToTop
				show={showScrollTop}
				onClick={scrollToTop}
				translations={translations}
			/>
			<Box
				ref={contentRef}
				tabIndex={-1}
				onScroll={handleScrollUpdate}
				onClick={handleClick}
				className={clsx(
					styles.contentArea,
					embedded && styles.contentAreaEmbedded,
				)}
			>
				<PageIndicator scrollInfo={scrollInfo} />
				{!hideHeader && (
					<Header
						selectedTag={selectedTag}
						isHeaderHidden={isHeaderHidden}
						showAbbreviations={showAbbreviations}
						title={title}
						translations={translations}
						currentParagraphIndex={currentParagraphIndex}
						onTitleClick={onTitleClick}
						customTags={customTags}
					/>
				)}
				{scrollInfo.clientHeight > 0 &&
					Array.from({ length: Math.max(0, scrollInfo.total - 1) }).map(
						(_, i) => (
							<Box
								key={i}
								className={styles.pageSeparator}
								style={{ top: (i + 1) * scrollInfo.clientHeight }}
							/>
						),
					)}
				{!hideContent && (
					<Content
						showMarkdown={showMarkdown}
						search={search}
						currentParagraphIndex={currentParagraphIndex}
						selectedTag={selectedTag}
						processedContent={processedContent}
						filteredParagraphs={filteredParagraphs}
						highlight={highlight}
						disableGlossary={embedded}
					/>
				)}
				{content && showMarkdown && !hidePlayer && !hideContent && (
					<Player
						contentRef={contentRef}
						onParagraphChange={setCurrentParagraphIndex}
						selectedTag={selectedTag}
						currentParagraphIndex={currentParagraphIndex}
					/>
				)}
				<JumpDialog
					open={jumpDialogOpen}
					onClose={() => setJumpDialogOpen(false)}
					onSubmit={handleJump}
					maxPage={scrollInfo.total}
					maxParagraphs={totalParagraphs}
				/>
				<ArticleTermsDialog
					open={termsDialogOpen}
					onClose={() => setTermsDialogOpen(false)}
					terms={articleTerms}
					onJump={(paragraph: any) => handleJump("paragraph", paragraph)}
				/>
			</Box>
		</Box>
	);
}

export default React.memo(Article);
