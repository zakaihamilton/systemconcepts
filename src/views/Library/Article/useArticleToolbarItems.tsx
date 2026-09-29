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
import Typography from "@ui/Typography";
import type { useTranslations } from "@util/domain/translations";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useMemo,
} from "react";
import styles from "./Article.module.css";

interface ArticleToolbarOptions {
	translations: ReturnType<typeof useTranslations>;
	handleExport: () => void;
	handlePrint: () => void;
	isAdmin: boolean;
	openEditDialog?: () => void;
	openEditContentDialog?: () => void;
	search: string;
	totalMatches: number;
	matchIndex: number;
	handlePrevMatch: () => void;
	handleNextMatch: () => void;
	showMarkdown: boolean;
	setShowMarkdown: Dispatch<SetStateAction<boolean>>;
	content: unknown;
	selectedTag: unknown;
	isPhone: boolean;
	handleShowTerms: () => void;
	showAbbreviations: boolean;
	setShowAbbreviations: Dispatch<SetStateAction<boolean>>;
	hideSquareBrackets: boolean;
	setHideSquareBrackets: Dispatch<SetStateAction<boolean>>;
	setJumpDialogOpen: Dispatch<SetStateAction<boolean>>;
	prevArticle?: { name?: string } | null;
	nextArticle?: { name?: string } | null;
	onPrev?: () => void;
	onNext?: () => void;
	isMobile: boolean;
	embedded?: boolean;
}

interface ArticleToolbarItem {
	id: string;
	name: ReactNode;
	icon?: ReactNode;
	element?: ReactNode;
	onClick?: () => void;
	menu?: boolean;
	divider?: boolean;
	location?: "header";
}

export function useArticleToolbarItems(options: ArticleToolbarOptions) {
	const {
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
	} = options;
	const toolbarItems = useMemo(() => {
		if (!content || !selectedTag || embedded) {
			return [];
		}
		let items: ArticleToolbarItem[] = [
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
	]);

	return toolbarItems;
}
