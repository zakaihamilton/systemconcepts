import React, { useCallback } from "react";

import ReferenceLink from "./ReferenceLink";
import { referencePattern } from "./referenceUtils";
import Term from "./Term";
import {
	collectGlossarySpans,
	Highlight,
	TextWithTerms,
} from "./TextWithTerms";

export { Highlight, TextWithTerms };

export function useGlossaryTextRenderer({
	search,
	disableGlossary,
	selectedTag,
}: any) {
	const TextRenderer = useCallback(
		({ children }: any) => {
			if (Array.isArray(children)) {
				return children.map((child, idx) => (
					<TextRenderer key={idx}>{child}</TextRenderer>
				));
			}

			if (React.isValidElement(children)) {
				const element = children as React.ReactElement<any>;
				return React.cloneElement(element, {
					children: <TextRenderer>{element.props.children}</TextRenderer>,
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

				const processGlossary = (text: any, keyPrefix: any) => {
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
