import { glossary } from "@data/glossary";
import Box from "@ui/Box";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { shouldSkipGlossaryTerm, termPattern } from "../GlossaryUtils";
import Zoom from "../Zoom";
import { normalizeMarkdownContent } from "./content";
import { useGlossaryTextRenderer } from "./GlossaryTextRenderer";
import styles from "./Markdown.module.css";
import termStyles from "./Term/Term.module.css";

const rehypeArticleEnrichment = () => {
	return (tree) => {
		let paragraphIndex = 0;
		const paragraphs = [];

		const visitAndSplit = (nodes) => {
			const newNodes = [];
			nodes.forEach((node) => {
				if (
					node.type === "element" &&
					(node.tagName === "p" ||
						node.tagName === "pre" ||
						node.tagName === "table" ||
						node.tagName === "hr" ||
						/^h[1-6]$/.test(node.tagName))
				) {
					paragraphIndex++;
					node.properties = {
						...node.properties,
						dataParagraphIndex: paragraphIndex,
					};
					newNodes.push(node);
					paragraphs.push(node);
				} else {
					if (node.children) {
						node.children = visitAndSplit(node.children);
						if (node.tagName === "li") {
							const index = findIndex(node.children);
							if (index !== undefined) {
								node.properties = {
									...node.properties,
									dataParagraphIndex: index,
								};
							}
						}
					}
					newNodes.push(node);
				}
			});
			return newNodes;
		};

		const findIndex = (nodes) => {
			if (!nodes) return undefined;
			for (const node of nodes) {
				if (node.properties?.dataParagraphIndex !== undefined)
					return node.properties.dataParagraphIndex;
				if (node.children) {
					const found = findIndex(node.children);
					if (found !== undefined) return found;
				}
			}
			return undefined;
		};

		if (tree.children) {
			tree.children = visitAndSplit(tree.children);
		}

		const totalParagraphs = paragraphIndex;
		paragraphs.forEach((node) => {
			node.properties = {
				...node.properties,
				dataTotalParagraphs: totalParagraphs,
			};
		});
		// Optimization: We could attach totalParagraphs to root or context,
		// but here we just loop again or assume component updates
	};
};

export default React.memo(function Markdown({
	children,
	search,
	currentParagraphIndex,
	selectedTag,
	filteredParagraphs,
	disableGlossary,
}) {
	const translations = useTranslations();
	const [zoomedData, setZoomedData] = useState(null);
	const paragraphsRef = useRef({});

	const processedChildren = useMemo(() => {
		return normalizeMarkdownContent(children);
	}, [children]);

	const TextRenderer = useGlossaryTextRenderer({
		search,
		disableGlossary,
		selectedTag,
	});

	const handleParagraphZoom = useCallback((children, number) => {
		setZoomedData({ content: children, number });
	}, []);

	const markdownComponents = useMemo(() => {
		// Extract plain text from children for TTS
		const extractText = (child) => {
			if (typeof child === "string") return child;
			if (Array.isArray(child)) return child.map(extractText).join("");
			if (React.isValidElement(child)) {
				const props = child.props;
				if (
					props?.className &&
					typeof props.className === "string" &&
					props.className.includes("glossary-main-text")
				) {
					return props.children || "";
				}
				if (
					props?.className &&
					typeof props.className === "string" &&
					props.className.includes("glossary-annotation")
				) {
					return "";
				}
				return extractText(props.children);
			}
			return "";
		};

		const getSpokenText = (text) => {
			if (!text) return text;
			return text.replace(termPattern, (match, _capture, offset, string) => {
				if (shouldSkipGlossaryTerm(match, string, offset)) {
					return match;
				}
				const lowerMatch = match.toLowerCase();
				const entry = glossary[lowerMatch];
				if (entry && entry.en) {
					return entry.en;
				}
				return match;
			});
		};

		const HeaderRenderer = (tag) => {
			const Header = ({ node, children }) => {
				const paragraphIndex = node?.properties?.dataParagraphIndex;
				if (
					Array.isArray(filteredParagraphs) &&
					!filteredParagraphs.includes(paragraphIndex)
				)
					return null;

				const currentIndex = Array.isArray(filteredParagraphs)
					? filteredParagraphs.indexOf(paragraphIndex)
					: -1;
				const needsGap =
					currentIndex > 0 &&
					paragraphIndex - filteredParagraphs[currentIndex - 1] > 1;

				const rawText = extractText(children);
				const paragraphText = getSpokenText(rawText);
				const paragraphSelected = currentParagraphIndex === paragraphIndex;
				return (
					<React.Fragment>
						{needsGap && <Box className={styles.gapSeparator}>•••</Box>}
						<Box
							component={tag}
							className={`${styles.header} ${paragraphSelected ? styles.selected : ""}`}
							data-paragraph-index={paragraphIndex}
							data-paragraph-text={paragraphText}
						>
							<TextRenderer>{children}</TextRenderer>
						</Box>
					</React.Fragment>
				);
			};
			Header.displayName = `Header${tag}`;
			return Header;
		};

		const ParagraphRenderer = ({ node, children }) => {
			const [hoveringNumber, setHoveringNumber] = useState(false);
			const paragraphIndex = node?.properties?.dataParagraphIndex;
			const totalParagraphs = node?.properties?.dataTotalParagraphs;
			const isLastParagraph = paragraphIndex === totalParagraphs;

			useEffect(() => {
				if (paragraphIndex !== undefined) {
					paragraphsRef.current[paragraphIndex] = children;
				}
			}, [paragraphIndex, children]);

			if (
				Array.isArray(filteredParagraphs) &&
				!filteredParagraphs.includes(paragraphIndex)
			)
				return null;
			if (!children || (Array.isArray(children) && children.length === 0))
				return null;

			// Fast path for embedded/disableGlossary: skip expensive operations
			if (disableGlossary) {
				return (
					<Box
						className={styles.paragraph}
						data-paragraph-index={paragraphIndex}
					>
						<TextRenderer>{children}</TextRenderer>
						<span className={styles.paragraphNumber}>
							<Tooltip title={translations?.ZOOM} placement="top" arrow>
								<span
									className={styles.paragraphNumberButton}
									onClick={(e) => {
										e.stopPropagation();
										handleParagraphZoom(children, paragraphIndex);
									}}
									style={{ cursor: "pointer" }}
								>
									{paragraphIndex !== undefined ? paragraphIndex : ""}
								</span>
							</Tooltip>
						</span>
					</Box>
				);
			}

			// Full path: with hover state, tooltips, zoom, etc.
			const rawText = extractText(children);
			const paragraphText = getSpokenText(rawText);
			const paragraphSelected = currentParagraphIndex === paragraphIndex;

			const currentIndex = Array.isArray(filteredParagraphs)
				? filteredParagraphs.indexOf(paragraphIndex)
				: -1;
			const needsGap =
				currentIndex > 0 &&
				paragraphIndex - filteredParagraphs[currentIndex - 1] > 1;

			return (
				<React.Fragment>
					{needsGap && <Box className={styles.gapSeparator}>•••</Box>}
					<Box
						className={`${styles.paragraph} ${paragraphSelected ? styles.selected : ""} ${hoveringNumber ? styles.suppressHover : ""}`}
						data-paragraph-index={paragraphIndex}
						data-paragraph-text={paragraphText}
					>
						<TextRenderer>{children}</TextRenderer>
						<span className={styles.paragraphNumber}>
							<Tooltip title={translations?.ZOOM} placement="top" arrow>
								<span
									data-prevent-select="true"
									className={clsx(
										styles.paragraphNumberButton,
										paragraphSelected && styles.selected,
									)}
									onMouseEnter={() => setHoveringNumber(true)}
									onMouseLeave={() => setHoveringNumber(false)}
									onClick={(e) => {
										e.stopPropagation();
										const number = node?.properties?.dataParagraphIndex;
										handleParagraphZoom(children, number);
									}}
								>
									{paragraphIndex !== undefined ? paragraphIndex : ""}
								</span>
							</Tooltip>
						</span>
					</Box>
					{isLastParagraph && (
						<Box className={styles.endOfArticle}>
							<Box className={styles.endOfArticleLine} />
							<Box className={styles.endOfArticleOrnament}>✦</Box>
							<Box className={styles.endOfArticleLine} />
						</Box>
					)}
				</React.Fragment>
			);
		};

		const BlockRenderer = (Tag) => {
			const Renderer = ({ node, children }) => {
				const paragraphIndex = node?.properties?.dataParagraphIndex;
				const span = node?.properties?.dataParagraphSpan || 1;

				if (Array.isArray(filteredParagraphs)) {
					const isVisible = filteredParagraphs.some(
						(p) => p >= paragraphIndex && p < paragraphIndex + span,
					);
					if (!isVisible) return null;
				}

				return (
					<Tag data-paragraph-index={paragraphIndex} data-paragraph-span={span}>
						{children}
					</Tag>
				);
			};
			Renderer.displayName = `BlockRenderer${Tag}`;
			return Renderer;
		};

		const VoidRenderer = (Tag) => {
			const Renderer = ({ node }) => {
				const paragraphIndex = node?.properties?.dataParagraphIndex;
				const span = node?.properties?.dataParagraphSpan || 1;

				if (Array.isArray(filteredParagraphs)) {
					const isVisible = filteredParagraphs.some(
						(p) => p >= paragraphIndex && p < paragraphIndex + span,
					);
					if (!isVisible) return null;
				}

				return (
					<Tag
						data-paragraph-index={paragraphIndex}
						data-paragraph-span={span}
					/>
				);
			};
			Renderer.displayName = `VoidRenderer${Tag}`;
			return Renderer;
		};

		const fullComponents = {
			p: ParagraphRenderer,
			li: ({ node, children }) => {
				const paragraphIndex = node?.properties?.dataParagraphIndex;
				if (Array.isArray(filteredParagraphs)) {
					// If we have an index and it's not in the allowed list, hide it.
					if (
						paragraphIndex !== undefined &&
						!filteredParagraphs.includes(paragraphIndex)
					)
						return null;
				}
				return (
					<Box className={styles.listItem}>
						<TextRenderer>{children}</TextRenderer>
					</Box>
				);
			},
			ul: BlockRenderer("ul"),
			ol: BlockRenderer("ol"),
			blockquote: BlockRenderer("blockquote"),
			pre: BlockRenderer("pre"),
			table: BlockRenderer("table"),
			hr: VoidRenderer("hr"),
			h1: HeaderRenderer("h1"),
			h2: HeaderRenderer("h2"),
			h3: HeaderRenderer("h3"),
			h4: HeaderRenderer("h4"),
			h5: HeaderRenderer("h5"),
			h6: HeaderRenderer("h6"),
			br: () => <span style={{ display: "block", marginBottom: "1.2rem" }} />,
		};

		const embeddedComponents = {
			p: ParagraphRenderer,
			h1: HeaderRenderer("h1"),
			h2: HeaderRenderer("h2"),
			h3: HeaderRenderer("h3"),
			h4: HeaderRenderer("h4"),
			h5: HeaderRenderer("h5"),
			h6: HeaderRenderer("h6"),
		};

		return { full: fullComponents, embedded: embeddedComponents };
	}, [
		currentParagraphIndex,
		filteredParagraphs,
		translations,
		TextRenderer,
		handleParagraphZoom,
		disableGlossary,
	]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<>
			<div className={styles.container}>
				<ReactMarkdown
					remarkPlugins={[remarkBreaks]}
					rehypePlugins={[rehypeArticleEnrichment]}
					components={
						disableGlossary
							? markdownComponents.embedded
							: markdownComponents.full
					}
				>
					{processedChildren}
				</ReactMarkdown>
			</div>

			<Zoom
				open={!!zoomedData}
				onClose={() => setZoomedData(null)}
				content={zoomedData?.content}
				number={zoomedData?.number}
				badgeClass={styles.paragraphBadge}
				Renderer={TextRenderer}
				copyExcludeSelectors={[`.${termStyles["glossary-annotation"]}`]}
				onNavigate={(number) => {
					const content = paragraphsRef.current[number];
					if (content) {
						setZoomedData({ content, number });
					}
				}}
			/>
		</>
	);
});
