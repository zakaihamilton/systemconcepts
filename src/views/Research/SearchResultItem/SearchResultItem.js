import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import IconButton from "@ui/IconButton";
import { normalizeContent, preprocessMarkdown } from "@util/data/string";
import Article from "@views/Library/Article";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SearchResultItem.module.css";

const SearchResultItem = ({ index, style, data }) => {
	const {
		results,
		gotoArticle,
		setRowHeight,
		highlight,
		translations = {},
	} = data || {};
	const doc = results ? results[index] : null;
	const rowRef = useRef(null);
	const [expanded, setExpanded] = useState(true);

	useEffect(() => {
		if (rowRef.current && setRowHeight) {
			const observer = new ResizeObserver((entries) => {
				for (let entry of entries) {
					const rect = entry.target.getBoundingClientRect();
					const height = rect.height;
					if (height > 0) {
						setRowHeight(index, height + 4);
					}
				}
			});
			observer.observe(rowRef.current);
			return () => observer.disconnect();
		}
	}, [index, setRowHeight, doc?.docId, expanded]);

	// Transform text: use shared normalization to match indexing
	const content = useMemo(() => {
		if (doc?.text) return normalizeContent(doc.text);
		if (doc?.paragraphs) {
			let paragraphs = doc.paragraphs;
			// For sessions, exclude the title (index 0) so numbering starts at 1 for the summary
			if (doc.isSession && paragraphs.length > 0) {
				paragraphs = paragraphs.slice(1);
			}
			let text = paragraphs.join("\n\n");

			// Fix formatting for session summaries: ensure numbered lists start on new lines
			if (doc.isSession) {
				text = preprocessMarkdown(text);
			}
			return text;
		}
		return "";
	}, [doc]);

	// filteredParagraphs:
	// - For sessions: null (show all paragraphs)
	// - For articles: 1-based indices of matches
	const filteredParagraphs = useMemo(() => {
		if (!doc?.matches) return [];
		// For sessions, show all paragraphs (return null to disable filtering)
		// For articles, use 1-based indexing for rendered paragraphs
		if (doc.isSession) return null;
		return doc.matches.map((m) => m.index + 1);
	}, [doc]);

	if (!doc) return null;

	const isLast = index === results.length - 1;
	const resultKind = doc.isSession ? "SESSION" : "ARTICLE";
	const toggleLabel = expanded
		? translations[`COLLAPSE_${resultKind}`] ||
			(doc.isSession ? "Collapse session" : "Collapse article")
		: translations[`EXPAND_${resultKind}`] ||
			(doc.isSession ? "Expand session" : "Expand article");

	return (
		<div style={style}>
			<div ref={rowRef} className={!isLast ? styles.separator : ""}>
				<div className={styles.resultMeta}>
					<Tooltip title={toggleLabel}>
						<IconButton
							size="small"
							className={clsx(
								styles.expandToggle,
								expanded && styles.expandToggleExpanded,
							)}
							onClick={() => setExpanded((value) => !value)}
							aria-expanded={expanded}
							aria-label={toggleLabel}
						>
							<ExpandMoreIcon />
						</IconButton>
					</Tooltip>
					<div className={styles.resultMetaInfo}>
						<span>
							{doc.isSession
								? translations.SESSIONS || "Session"
								: translations.ARTICLES || "Article"}
						</span>
						<span>{`${doc.matches?.length || 0} ${translations.MATCH || "matches"}`}</span>
					</div>
				</div>
				<Article
					selectedTag={doc.tag}
					content={content}
					filteredParagraphs={filteredParagraphs}
					onTitleClick={() => gotoArticle(doc.tag)}
					embedded={true}
					hidePlayer={true}
					hideContent={!expanded}
					highlight={highlight}
					customTags={doc.customTags}
				/>
			</div>
		</div>
	);
};

export default React.memo(SearchResultItem);
