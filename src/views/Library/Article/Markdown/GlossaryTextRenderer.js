import { glossary } from "@data/glossary";
import React, { useCallback } from "react";

import { termPattern } from "../GlossaryUtils";
import styles from "./Markdown.module.css";
import { referencePattern } from "./referenceUtils";
import Term from "./Term";

function extendTermEndForParenthetical(text, end, term, glossaryEntry) {
	const textAfter = text.slice(end);
	const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(textAfter);
	if (parentheticalMatch) {
		const content = parentheticalMatch[1].trim().toLowerCase();
		const mainText = (
			glossaryEntry?.en ||
			glossaryEntry?.trans ||
			term
		).toLowerCase();
		if (content === mainText || content === term.toLowerCase()) {
			return end + parentheticalMatch[0].length;
		}
	}
	return end;
}

function collectGlossarySpans(text) {
	const spans = [];
	const matches = [...text.matchAll(termPattern)];

	for (const match of matches) {
		const term = match[0];
		const start = match.index;
		let end = start + term.length;
		const glossaryEntry = glossary[term.toLowerCase()];
		end = extendTermEndForParenthetical(text, end, term, glossaryEntry);
		spans.push({ term, start, end, glossaryEntry });
	}

	return spans;
}

function shouldSkipGlossaryTerm(term, text, start) {
	if (term === "or") {
		return true;
	}
	if (term === "Or") {
		const isStartOfSentence =
			start === 0 || /[\.!\?]\s+$/.test(text.slice(0, start));
		return isStartOfSentence;
	}
	return false;
}

export function Highlight({ search, children }) {
	if (!search || !children || typeof children !== "string") return children;

	const terms = Array.isArray(search) ? search : [search];
	if (terms.length === 0) return children;

	const lowerChildren = children.toLowerCase();
	const matches = [];
	terms.forEach((term) => {
		if (!term) return;
		const lowerTerm = term.toLowerCase();
		let index = lowerChildren.indexOf(lowerTerm);
		while (index !== -1) {
			matches.push({ start: index, end: index + term.length });
			index = lowerChildren.indexOf(lowerTerm, index + 1);
		}
	});

	if (matches.length === 0) return children;

	matches.sort((a, b) => a.start - b.start);
	const merged = [];
	if (matches.length > 0) {
		let current = matches[0];
		for (let i = 1; i < matches.length; i++) {
			const next = matches[i];
			if (next.start < current.end) {
				current.end = Math.max(current.end, next.end);
			} else {
				merged.push(current);
				current = next;
			}
		}
		merged.push(current);
	}

	const parts = [];
	let currentIndex = 0;

	merged.forEach((match) => {
		if (match.start > currentIndex) {
			parts.push(children.slice(currentIndex, match.start));
		}
		parts.push(
			<span
				key={match.start}
				className={`${styles["search-highlight"]} search-highlight`}
			>
				{children.slice(match.start, match.end)}
			</span>,
		);
		currentIndex = match.end;
	});

	if (currentIndex < children.length) {
		parts.push(children.slice(currentIndex));
	}

	return parts;
}

// Component to render text with glossary terms (fully interactive)
export function TextWithTerms({ text }) {
	const spans = collectGlossarySpans(text);
	if (spans.length === 0) return text;

	const parts = [];
	let lastIndex = 0;

	for (const { term, start, end, glossaryEntry } of spans) {
		if (start > lastIndex) {
			parts.push(text.slice(lastIndex, start));
		}

		parts.push(
			<span key={start}>
				<Term term={term} entry={glossaryEntry} />
			</span>,
		);

		lastIndex = end;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts.length > 0 ? parts : text;
}

export function useGlossaryTextRenderer({
	search,
	disableGlossary,
	selectedTag,
}) {
	const TextRenderer = useCallback(
		({ children }) => {
			if (Array.isArray(children)) {
				return children.map((child, idx) => (
					<TextRenderer key={idx}>{child}</TextRenderer>
				));
			}

			if (React.isValidElement(children)) {
				return React.cloneElement(children, {
					children: <TextRenderer>{children.props.children}</TextRenderer>,
				});
			}

			if (typeof children === "string") {
				if (disableGlossary) {
					return <Highlight search={search}>{children}</Highlight>;
				}

				let cleanChildren = children;
				cleanChildren = cleanChildren.replace(/\u00A0/g, " ");
				cleanChildren = cleanChildren.replace(/\u200B/g, "");
				cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ",");
				if (cleanChildren.match(/,[\s,]+,/)) {
					cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ",");
				}

				const references = [];
				const refMatches = [...cleanChildren.matchAll(referencePattern)];
				for (const refMatch of refMatches) {
					references.push({
						text: refMatch[0],
						sectionName: refMatch[1] ? refMatch[1].trim() : null,
						chapterName: refMatch[2],
						itemNumber: refMatch[3] || null,
						start: refMatch.index,
						end: refMatch.index + refMatch[0].length,
					});
				}

				const processGlossary = (text, keyPrefix) => {
					const parts = [];
					let lastIndex = 0;
					const spans = collectGlossarySpans(text);

					for (const { term, start, end, glossaryEntry } of spans) {
						if (start > lastIndex) {
							parts.push(
								<Highlight key={`${keyPrefix}-text-${start}`} search={search}>
									{text.slice(lastIndex, start)}
								</Highlight>,
							);
						}

						if (shouldSkipGlossaryTerm(term, text, start)) {
							lastIndex = start;
							continue;
						}

						parts.push(
							<Term
								key={`${keyPrefix}-gloss-${start}`}
								term={term}
								entry={glossaryEntry}
								search={search}
							/>,
						);

						lastIndex = end;
					}

					if (lastIndex < text.length) {
						parts.push(
							<Highlight key={`${keyPrefix}-text-end`} search={search}>
								{text.slice(lastIndex)}
							</Highlight>,
						);
					}

					return parts.length > 0 ? (
						parts
					) : (
						<Highlight search={search}>{text}</Highlight>
					);
				};

				if (references.length === 0) {
					return processGlossary(cleanChildren, "main");
				}

				const parts = [];
				let lastRefEnd = 0;
				const ReferenceLink = require("./ReferenceLink").default;

				references.forEach((ref, idx) => {
					if (ref.start > lastRefEnd) {
						const beforeText = cleanChildren.slice(lastRefEnd, ref.start);
						const glossaryParts = processGlossary(
							beforeText,
							`before-ref-${idx}`,
						);
						if (Array.isArray(glossaryParts)) {
							parts.push(...glossaryParts);
						} else {
							parts.push(glossaryParts);
						}
					}


					parts.push(
						<ReferenceLink
							key={`ref-${idx}`}
							text={ref.text}
							sectionName={ref.sectionName}
							chapterName={ref.chapterName}
							itemNumber={ref.itemNumber}
							currentTag={selectedTag}
						/>,
					);

					lastRefEnd = ref.end;
				});

				if (lastRefEnd < cleanChildren.length) {
					const afterText = cleanChildren.slice(lastRefEnd);
					const glossaryParts = processGlossary(afterText, "after-ref");
					if (Array.isArray(glossaryParts)) {
						parts.push(...glossaryParts);
					} else {
						parts.push(glossaryParts);
					}
				}

				return parts;
			}

			return children;
		},
		[search, selectedTag, disableGlossary],
	);

	return TextRenderer;
}
