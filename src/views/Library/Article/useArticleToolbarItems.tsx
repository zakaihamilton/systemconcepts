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
	const toolbarItems = useMemo(() => {
		if (!options.content || !options.selectedTag || options.embedded) {
			return [];
		}
		let items: ArticleToolbarItem[] = [
			{
				id: "toggleAbbreviations",
				name: options.showAbbreviations
					? options.translations.SHOW_FULL_TERMS
					: options.translations.SHOW_ABBREVIATIONS,
				icon: <LibraryBooksIcon />,
				onClick: () => options.setShowAbbreviations((prev) => !prev),
				menu: true,
			},
			{
				id: "toggleSquareBrackets",
				name: options.hideSquareBrackets
					? options.translations.SHOW_SQUARE_BRACKETS
					: options.translations.HIDE_SQUARE_BRACKETS,
				icon: <DataArrayIcon />,
				onClick: () => options.setHideSquareBrackets((prev) => !prev),
				menu: true,
			},
			{
				id: "toggleMarkdown",
				name: options.showMarkdown
					? options.translations.VIEW_PLAIN_TEXT
					: options.translations.VIEW_MARKDOWN,
				icon: options.showMarkdown ? <CodeOffIcon /> : <CodeIcon />,
				onClick: () => options.setShowMarkdown((prev) => !prev),
				menu: true,
				divider: true,
			},
			{
				id: "jumpToParagraph",
				name: options.translations.JUMP_TO,
				icon: <FormatListNumberedIcon />,
				onClick: () => options.setJumpDialogOpen(true),
				menu: true,
			},
			{
				id: "articleTerms",
				name: options.translations.ARTICLE_TERMS,
				icon: <MenuBookIcon />,
				onClick: options.handleShowTerms,
				menu: true,
				divider: true,
			},
		];
		if (options.isAdmin) {
			if (options.openEditDialog) {
				items.push({
					id: "editTags",
					name: options.translations.EDIT_TAGS,
					icon: <EditIcon />,
					onClick: options.openEditDialog,
					menu: true,
				});
			}
			if (options.openEditContentDialog) {
				items.push({
					id: "editArticle",
					name: options.translations.EDIT_ARTICLE,
					icon: <ArticleIcon />,
					onClick: options.openEditContentDialog,
					menu: true,
					divider: true,
				});
			}
		}

		// eslint-disable-next-line react-hooks/refs
		items.push({
			id: "export",
			name: options.showMarkdown
				? options.translations.PRINT
				: options.translations.EXPORT_TO_MD,
			icon: options.showMarkdown ? <PrintIcon /> : <DownloadIcon />,
			onClick: () => {
				if (options.showMarkdown) options.handlePrint();
				else options.handleExport();
			},
			menu: true,
		});

		if (options.search && options.totalMatches > 0) {
			items = [
				...items,
				{
					id: "prevMatch",
					name: options.translations.PREVIOUS_MATCH,
					icon: <KeyboardArrowUpIcon />,
					onClick: options.handlePrevMatch,
					location: options.isPhone ? "header" : undefined,
				},
				{
					id: "matchCount",
					name:
						options.totalMatches > 0
							? `${options.matchIndex + 1} / ${options.totalMatches}`
							: "0 / 0",
					element: (
						<Typography
							key="matchCount"
							variant="caption"
							className={styles.matchCount}
						>
							{options.totalMatches > 0
								? `${options.matchIndex + 1} / ${options.totalMatches}`
								: "0 / 0"}
						</Typography>
					),
					location: options.isPhone ? "header" : undefined,
				},
				{
					id: "nextMatch",
					name: options.translations.NEXT_MATCH,
					icon: <KeyboardArrowDownIcon />,
					onClick: options.handleNextMatch,
					location: options.isPhone ? "header" : undefined,
				},
			];
		}

		if (options.onPrev && options.prevArticle) {
			const previousTooltip = options.prevArticle.name ? (
				<span className={styles.tooltip}>
					<b>{options.translations.PREVIOUS}</b> {options.prevArticle.name}
				</span>
			) : (
				<b>{options.translations.PREVIOUS}</b>
			);
			items.push({
				id: "prevArticle",
				name: previousTooltip,
				icon: <ArrowBackIcon />,
				onClick: options.onPrev,
				location: options.isMobile ? undefined : "header",
			});
		}

		if (options.onNext && options.nextArticle) {
			const nextTooltip = options.nextArticle.name ? (
				<span className={styles.tooltip}>
					<b>{options.translations.NEXT}</b> {options.nextArticle.name}
				</span>
			) : (
				<b>{options.translations.NEXT}</b>
			);
			items.push({
				id: "nextArticle",
				name: nextTooltip,
				icon: <ArrowForwardIcon />,
				onClick: options.onNext,
				location: options.isMobile ? undefined : "header",
			});
		}

		return items;
	}, [
		options.translations,
		options.handleExport,
		options.handlePrint,
		options.isAdmin,
		options.openEditDialog,
		options.openEditContentDialog,
		options.search,
		options.totalMatches,
		options.matchIndex,
		options.handlePrevMatch,
		options.handleNextMatch,
		options.showMarkdown,
		options.setShowMarkdown,
		options.content,
		options.selectedTag,
		options.isPhone,
		options.handleShowTerms,
		options.showAbbreviations,
		options.setShowAbbreviations,
		options.hideSquareBrackets,
		options.setHideSquareBrackets,
		options.setJumpDialogOpen,
		options.prevArticle,
		options.nextArticle,
		options.onPrev,
		options.onNext,
		options.isMobile,
		options.embedded,
	]);

	return toolbarItems;
}
