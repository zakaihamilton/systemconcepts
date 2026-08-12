import { glossary } from "@data/glossary";

import {
	hasConfirmingGlossaryParenthetical,
	shouldSkipGlossaryTerm,
	termPattern,
} from "../GlossaryUtils";
import styles from "./Markdown.module.css";
import Term from "./Term";

export function extendTermEndForParenthetical(text, end, term, glossaryEntry) {
	if (hasConfirmingGlossaryParenthetical(text, end, term, glossaryEntry)) {
		const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(text.slice(end));
		return end + parentheticalMatch[0].length;
	}
	return end;
}

export function collectGlossarySpans(text) {
	const spans = [];
	const matches = [...text.matchAll(termPattern)];

	for (const match of matches) {
		const term = match[0];
		const start = match.index;
		if (shouldSkipGlossaryTerm(term, text, start)) {
			continue;
		}
		let end = start + term.length;
		const glossaryEntry = glossary[term.toLowerCase()];
		end = extendTermEndForParenthetical(text, end, term, glossaryEntry);
		spans.push({ term, start, end, glossaryEntry });
	}

	return spans;
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
