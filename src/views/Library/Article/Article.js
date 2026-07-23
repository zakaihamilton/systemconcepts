import { useSearch } from "@components/Search";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowBackIcon from "@icons/svg/ArrowBack.svg";
import ArrowForwardIcon from "@icons/svg/ArrowForward.svg";
import ArticleIcon from "@icons/svg/Article.svg";
import CodeIcon from "@icons/svg/Code.svg";
import CodeOffIcon from "@icons/svg/CodeOff.svg";
import DataArrayIcon from "@icons/svg/DataArray.svg";
import DownloadIcon from "@icons/svg/Download.svg";
import EditIcon from "@icons/svg/Edit.svg";
import FormatListNumberedIcon from "@icons/svg/FormatListNumbered.svg";
import KeyboardArrowDownIcon from "@icons/svg/KeyboardArrowDown.svg";
import KeyboardArrowUpIcon from "@icons/svg/KeyboardArrowUp.svg";
import LibraryBooksIcon from "@icons/svg/LibraryBooks.svg";
import MenuBookIcon from "@icons/svg/MenuBook.svg";
import PrintIcon from "@icons/svg/Print.svg";
import Box from "@ui/Box";
import CircularProgress from "@ui/CircularProgress";
import Typography from "@ui/Typography";
import { roleAuth } from "@util/auth/roles";
import { useLocalStorage } from "@util/browser/hooks";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { useTranslations } from "@util/domain/translations";
import { exportData } from "@util/storage/importExport";
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
import { useArticleScroll } from "./useArticleScroll";
import { useArticleSearch } from "./useArticleSearch";

registerToolbar("Article");

/**
 * ArticleToolbar Component
 * Handles global toolbar registration for the Article page.
 * Rendered only when the article is NOT embedded.
 */
function ArticleToolbar({ id, items, visible, depends }) {
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
}) {
	const translations = useTranslations();
	const search = useSearch("default", null, !embedded);
	const contentRef = useRef(null);
	const [isHeaderHidden, setIsHeaderHidden] = useState(false);

	const role = Cookies.get("role");
	const isAdmin = roleAuth(role, "admin");

	const handleScroll = useCallback(
		(e) => {
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
	const [articleTerms, setArticleTerms] = useState([]);
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
		(type, value) => {
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

	const handleClick = useCallback((e) => {
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
					window.history.replaceState(null, null, newHash);
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

	const formatArticleWithTags = useCallback((tag, text) => {
		if (!tag) return text;
		const metadata = LibraryTagKeys.map((key) => {
			const val = tag[key];
			if (!val) return null;
			const label = key.charAt(0).toUpperCase() + key.slice(1);
			return `${label}: ${val}`;
		})
			.filter(Boolean)
			.join("\n");

		return `${metadata}\n\n${"=".repeat(20)}\n\n${text || ""}`;
	}, []);

	const handlePrint = useCallback(() => {
		const rootElement = contentRef.current;
		if (!rootElement) return;

		const iframe = document.createElement("iframe");
		iframe.id = "print-root";
		Object.assign(iframe.style, {
			position: "absolute",
			top: "-9999px",
			left: "-9999px",
			width: "100%",
			height: "auto",
		});
		document.body.appendChild(iframe);

		const cssStyles = Array.from(
			document.querySelectorAll("style, link[rel='stylesheet']"),
		)
			.map((node) => node.outerHTML)
			.join("");

		const doc = iframe.contentWindow.document;
		doc.open();
		doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                ${cssStyles}
                <style>
                    :global(body), html, body {
                        background: white !important;
                        height: auto !important;
                        overflow: visible !important;
                        width: 100% !important;
                    }
                    [class*="Article_root"] {
                        position: static !important;
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        visibility: visible !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        width: 100% !important;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                        .print-hidden { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div id="print-root" class="${styles.root}">
                    ${rootElement.outerHTML}
                </div>
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                window.top.postMessage("print-complete", "*");
                            }, 1000);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
		doc.close();

		let cleanupExecuted = false;
		const cleanup = (e) => {
			if (cleanupExecuted) return;
			if (e && e.data !== "print-complete") return;

			cleanupExecuted = true;
			setTimeout(() => {
				if (document.body.contains(iframe)) {
					document.body.removeChild(iframe);
				}
			}, 5000);
			window.removeEventListener("message", cleanup);
		};

		window.addEventListener("message", cleanup);

		// Fallback cleanup after 30 seconds to prevent memory leak
		setTimeout(() => cleanup(), 30000);
	}, [contentRef]);

	const handleExport = useCallback(() => {
		if (!selectedTag || !content) return;
		const formatted = formatArticleWithTags(selectedTag, content);
		const filename = `${selectedTag.article || "Article"}${selectedTag.number ? `_${selectedTag.number}` : ""}.md`;
		exportData(formatted, filename, "text/plain");
	}, [selectedTag, content, formatArticleWithTags]);

	const toolbarItems = useMemo(() => {
		if (!content || !selectedTag || embedded) {
			return [];
		}
		let items = [
			{
				id: "toggleAbbreviations",
				name: showAbbreviations
					? translations.SHOW_FULL_TERMS
					: translations.SHOW_ABBREVIATIONS,
				icon: <LibraryBooksIcon />,
				onClick: () => setShowAbbreviations((prev) => !prev),
				menu: true,
			},
			{
				id: "toggleSquareBrackets",
				name: hideSquareBrackets
					? translations.SHOW_SQUARE_BRACKETS
					: translations.HIDE_SQUARE_BRACKETS,
				icon: <DataArrayIcon />,
				onClick: () => setHideSquareBrackets((prev) => !prev),
				menu: true,
			},
			{
				id: "toggleMarkdown",
				name: showMarkdown
					? translations.VIEW_PLAIN_TEXT
					: translations.VIEW_MARKDOWN,
				icon: showMarkdown ? <CodeOffIcon /> : <CodeIcon />,
				onClick: () => setShowMarkdown((prev) => !prev),
				menu: true,
				divider: true,
			},
			{
				id: "jumpToParagraph",
				name: translations.JUMP_TO,
				icon: <FormatListNumberedIcon />,
				onClick: () => setJumpDialogOpen(true),
				menu: true,
			},
			{
				id: "articleTerms",
				name: translations.ARTICLE_TERMS,
				icon: <MenuBookIcon />,
				onClick: handleShowTerms,
				menu: true,
				divider: true,
			},
		];
		if (isAdmin) {
			if (openEditDialog) {
				items.push({
					id: "editTags",
					name: translations.EDIT_TAGS,
					icon: <EditIcon />,
					onClick: openEditDialog,
					menu: true,
				});
			}
			if (openEditContentDialog) {
				items.push({
					id: "editArticle",
					name: translations.EDIT_ARTICLE,
					icon: <ArticleIcon />,
					onClick: openEditContentDialog,
					menu: true,
					divider: true,
				});
			}
		}

		// eslint-disable-next-line react-hooks/refs
		items.push({
			id: "export",
			name: showMarkdown ? translations.PRINT : translations.EXPORT_TO_MD,
			icon: showMarkdown ? <PrintIcon /> : <DownloadIcon />,
			onClick: () => {
				if (showMarkdown) handlePrint();
				else handleExport();
			},
			menu: true,
		});

		if (search && totalMatches > 0) {
			items = [
				...items,
				{
					id: "prevMatch",
					name: translations.PREVIOUS_MATCH,
					icon: <KeyboardArrowUpIcon />,
					onClick: handlePrevMatch,
					location: isPhone ? "header" : undefined,
				},
				{
					id: "matchCount",
					name:
						totalMatches > 0 ? `${matchIndex + 1} / ${totalMatches}` : "0 / 0",
					element: (
						<Typography
							key="matchCount"
							variant="caption"
							className={styles.matchCount}
						>
							{totalMatches > 0
								? `${matchIndex + 1} / ${totalMatches}`
								: "0 / 0"}
						</Typography>
					),
					location: isPhone ? "header" : undefined,
				},
				{
					id: "nextMatch",
					name: translations.NEXT_MATCH,
					icon: <KeyboardArrowDownIcon />,
					onClick: handleNextMatch,
					location: isPhone ? "header" : undefined,
				},
			];
		}

		if (onPrev && prevArticle) {
			const previousTooltip = prevArticle.name ? (
				<span className={styles.tooltip}>
					<b>{translations.PREVIOUS}</b> {prevArticle.name}
				</span>
			) : (
				<b>{translations.PREVIOUS}</b>
			);
			items.push({
				id: "prevArticle",
				name: previousTooltip,
				icon: <ArrowBackIcon />,
				onClick: onPrev,
				location: isMobile ? undefined : "header",
			});
		}

		if (onNext && nextArticle) {
			const nextTooltip = nextArticle.name ? (
				<span className={styles.tooltip}>
					<b>{translations.NEXT}</b> {nextArticle.name}
				</span>
			) : (
				<b>{translations.NEXT}</b>
			);
			items.push({
				id: "nextArticle",
				name: nextTooltip,
				icon: <ArrowForwardIcon />,
				onClick: onNext,
				location: isMobile ? undefined : "header",
			});
		}

		return items;
	}, [
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
		content,
		selectedTag,
		isPhone,
		handleShowTerms,
		showAbbreviations,
		setShowAbbreviations,
		hideSquareBrackets,
		setHideSquareBrackets,
		prevArticle,
		nextArticle,
		onPrev,
		onNext,
		isMobile,
		embedded,
	]);

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
					onJump={(paragraph) => handleJump("paragraph", paragraph)}
				/>
			</Box>
		</Box>
	);
}

export default React.memo(Article);
