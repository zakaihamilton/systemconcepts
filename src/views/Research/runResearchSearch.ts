import { loadParagraphsForFile as defaultLoadParagraphs } from "@util/domain/loadParagraphs";
import { getAllowedResearchFileIndices } from "./searchFilters";
import {
	clauseMatchesText,
	getSearchTerms,
	parseResearchQuery,
	rankResearchResults,
} from "./searchQuery";
import type {
	ResearchFilter,
	ResearchLibraryTag,
	ResearchMatch,
	ResearchResult,
	ResearchSearchIndex,
	ResearchSearchOutcome,
	ResearchSession,
	ResearchTranslations,
} from "./types";

interface IndexVersionFlags {
	isV2: boolean;
	isV3: boolean;
	isV4: boolean;
	isV5: boolean;
}

const capitalize = (value: string | number | undefined) => {
	if (!value) return "";
	const str = String(value);
	if (str.toLowerCase() === "ai") return "AI";
	return str.charAt(0).toUpperCase() + str.slice(1);
};

const normalize = (value: string | number | null | undefined) =>
	String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

function expandTokenRefs(
	refs: string[] | number[] | null | undefined,
	{ isV3, isV4, isV5 }: IndexVersionFlags,
) {
	const tokenRefs = new Set<string>();
	if (!refs) return tokenRefs;
	if (isV4 || isV5) {
		let currentFileIndex = -1;
		for (const value of refs as number[]) {
			if (value < 0) {
				currentFileIndex = -value - 1;
			} else if (currentFileIndex !== -1) {
				tokenRefs.add(`${currentFileIndex}:${value}`);
			}
		}
	} else if (isV3) {
		const numericRefs = refs as number[];
		for (let i = 0; i < numericRefs.length; i += 2) {
			tokenRefs.add(`${numericRefs[i]}:${numericRefs[i + 1]}`);
		}
	} else {
		for (const ref of refs) tokenRefs.add(String(ref));
	}
	return tokenRefs;
}

function buildDocFromRef(
	docId: string,
	indexData: ResearchSearchIndex,
	versions: IndexVersionFlags,
	libraryTags: ResearchLibraryTag[],
	sessionsById: Map<string, ResearchSession>,
	paragraphsMap: Map<number, string[]>,
): ResearchResult | null {
	const { isV2, isV3, isV4, isV5 } = versions;
	if (isV3 || isV2 || isV4 || isV5) {
		const fileIndex = Number.parseInt(docId, 10);
		const tagId = indexData.f?.[fileIndex];
		if (!tagId) return null;
		const paragraphs = isV5
			? paragraphsMap.get(fileIndex)
			: indexData.d?.[fileIndex];

		if (tagId.startsWith("session|")) {
			const parts = tagId.split("|");
			if (parts.length < 5) return null;
			const session = sessionsById.get(tagId) || {
				group: parts[1],
				year: parts[2],
				date: parts[3],
				name: parts.slice(4).join("|"),
			};
			return {
				...session,
				docId: tagId,
				isSession: true,
				customTags: [
					{ label: "Group", value: capitalize(session.group) },
					{ label: "Year", value: session.year },
					{ label: "Date", value: session.date },
					{ label: "Type", value: capitalize(session.type) },
				],
				tag: { title: session.name, _id: tagId },
				paragraphs,
				matches: [],
			};
		}

		const tag = libraryTags.find((item) => item._id === tagId);
		if (!tag) return null;
		return {
			docId: tagId,
			tag,
			paragraphs,
			matches: [],
		};
	}

	const v1Doc = indexData.files?.[docId];
	if (v1Doc) {
		return {
			...v1Doc,
			docId,
			matches: [],
		};
	}
	return null;
}

function addFilterOnlySessionMatch(doc: ResearchResult) {
	if (doc.matches.length > 0) return;

	let summaryText =
		doc.summaryText ||
		(typeof doc.summary === "string" ? doc.summary : "") ||
		doc.description ||
		"";
	let useParagraphs = !summaryText;

	if (summaryText && doc.tag) {
		const pText = normalize(summaryText);
		const tText = normalize(doc.tag.title);
		if (pText === tText || pText.includes(tText) || tText.includes(pText)) {
			useParagraphs = true;
		}
	}

	if (useParagraphs && doc.paragraphs && doc.paragraphs.length > 0) {
		let found = false;
		if (doc.tag) {
			const tText = normalize(doc.tag.title);
			for (const para of doc.paragraphs) {
				const pText = normalize(para);
				if (
					pText &&
					pText !== tText &&
					!pText.includes(tText) &&
					!tText.includes(pText)
				) {
					summaryText = para;
					found = true;
					break;
				}
				if (
					pText &&
					pText.includes(tText) &&
					pText.length > tText.length + 10
				) {
					summaryText = para;
					found = true;
					break;
				}
			}
		}
		if (!found && !summaryText && doc.paragraphs.length > 0) {
			const firstParagraph = doc.paragraphs[0];
			const titleText = doc.tag ? normalize(doc.tag.title) : "";
			const firstParagraphText = normalize(firstParagraph);
			if (
				firstParagraphText !== titleText &&
				!firstParagraphText.includes(titleText)
			) {
				summaryText = firstParagraph;
			}
		}
	}

	doc.paragraphs = [summaryText];
	doc.matches.push({ index: 0, text: summaryText });
}

function stripSessionTitleMatches(doc: ResearchResult) {
	if (!doc.isSession || !doc.tag || doc.matches.length === 0) return;
	const titleText = normalize(doc.tag.title);
	const firstMatch = doc.matches[0];
	if (firstMatch.index !== 0) return;
	const paragraphText = normalize(firstMatch.text);
	if (
		paragraphText === titleText ||
		paragraphText.includes(titleText) ||
		titleText.includes(paragraphText)
	) {
		doc.matches.shift();
		if (
			doc.matches.length === 0 &&
			doc.paragraphs &&
			doc.paragraphs.length > 1
		) {
			doc.matches.push({ index: 1, text: doc.paragraphs[1] });
		}
	}
}

interface RunResearchSearchOptions {
	indexData?: ResearchSearchIndex | null;
	searchQuery?: string;
	sessionsById?: Map<string, ResearchSession>;
	libraryTags?: ResearchLibraryTag[];
	filterTags?: ResearchFilter[];
	translations?: ResearchTranslations;
	loadParagraphsForFile?: (
		fileId: string,
		sessionsById: Map<string, ResearchSession>,
	) => Promise<string[]>;
	isCancelled?: () => boolean;
	onProgress?: (progress: number) => void;
}

/**
 * Run a Research search against a decoded index.
 * Pure of React; callers supply cancellation and progress hooks.
 */
export async function runResearchSearch({
	indexData,
	searchQuery = "",
	sessionsById = new Map<string, ResearchSession>(),
	libraryTags = [],
	filterTags = [],
	translations = {},
	loadParagraphsForFile = defaultLoadParagraphs,
	isCancelled = () => false,
	onProgress = () => {},
}: RunResearchSearchOptions): Promise<ResearchSearchOutcome> {
	if (!indexData) {
		return { results: [], highlight: [] };
	}

	const orGroups = parseResearchQuery(searchQuery);
	const searchTerms = getSearchTerms(searchQuery);
	const finalRefs = new Set<string>();
	const paragraphCache = new Map<number, string[]>();

	const isV2 = indexData.v === 2;
	const isV3 = indexData.v === 3;
	const isV4 = indexData.v === 4;
	const isV5 = indexData.v >= 5;
	const versions = { isV2, isV3, isV4, isV5 };

	// Narrow candidates by filter metadata before any paragraph I/O.
	const allowedFileIndices = getAllowedResearchFileIndices(
		indexData,
		filterTags,
		translations,
		{ libraryTags, sessionsById },
	);
	const isFileAllowed = (fileIndex: number) =>
		!allowedFileIndices || allowedFileIndices.has(fileIndex);

	if (!searchQuery.trim()) {
		if (indexData.f) {
			for (let i = 0; i < indexData.f.length; i++) {
				if (isFileAllowed(i)) finalRefs.add(`${i}:0`);
			}
		}
	} else {
		for (const parsedAndClauses of orGroups) {
			if (parsedAndClauses.length === 0) continue;
			if (isCancelled()) return { results: [], highlight: [], cancelled: true };

			const allTokensInGroup = [
				...new Set(parsedAndClauses.flatMap((clause) => clause.terms)),
			];
			let groupRefs: Set<string> | null = null;

			for (const token of allTokensInGroup) {
				if (isCancelled())
					return { results: [], highlight: [], cancelled: true };

				const tokenIndex = indexData.t || indexData.tokens || {};
				const matchingTokens = Object.keys(tokenIndex).filter((key) =>
					key.includes(token),
				);
				const tokenRefs = new Set<string>();
				matchingTokens.forEach((key) => {
					const refs =
						isV2 || isV3 || isV4 || isV5
							? indexData.t?.[key]
							: indexData.tokens?.[key];
					expandTokenRefs(refs, versions).forEach((ref) => {
						const fileIndex = Number.parseInt(ref.split(":")[0], 10);
						if (isFileAllowed(fileIndex)) tokenRefs.add(ref);
					});
				});

				if (groupRefs === null) {
					groupRefs = tokenRefs;
				} else {
					groupRefs = new Set<string>(
						[...groupRefs].filter((ref: string) => tokenRefs.has(ref)),
					);
				}
			}

			if (groupRefs) {
				if (isV5) {
					const uniqueFileIndices = new Set<number>();
					for (const ref of groupRefs) {
						const [docId] = ref.split(":");
						uniqueFileIndices.add(Number.parseInt(docId, 10));
					}

					const fileIndicesArray = [...uniqueFileIndices];
					let loadedCount = 0;
					const totalFiles = fileIndicesArray.length;

					await Promise.all(
						fileIndicesArray.map(async (fileIndex) => {
							if (!paragraphCache.has(fileIndex)) {
								const fileId = indexData.f?.[fileIndex];
								if (fileId !== undefined) {
									const paragraphs = await loadParagraphsForFile(
										fileId,
										sessionsById,
									);
									paragraphCache.set(fileIndex, paragraphs);
								}
							}

							loadedCount++;
							if (!isCancelled()) {
								onProgress(
									totalFiles ? Math.floor((loadedCount / totalFiles) * 50) : 50,
								);
							}
						}),
					);

					if (!isCancelled()) onProgress(50);
				}

				for (const ref of groupRefs) {
					const [docId, paragraphId] = ref.split(":");
					let paragraph: string | undefined;
					if (isV5) {
						const fileIndex = Number.parseInt(docId, 10);
						paragraph =
							paragraphCache.get(fileIndex)?.[Number.parseInt(paragraphId, 10)];
					} else if (isV3 || isV2 || isV4) {
						const fileIndex = Number.parseInt(docId, 10);
						paragraph =
							indexData.d?.[fileIndex]?.[Number.parseInt(paragraphId, 10)];
					} else {
						paragraph =
							indexData.files?.[docId]?.paragraphs?.[
								Number.parseInt(paragraphId, 10)
							];
					}

					if (paragraph) {
						const isMatch = parsedAndClauses.every((clause) =>
							clauseMatchesText(clause, paragraph),
						);
						if (isMatch) finalRefs.add(ref);
					}
				}
			}
		}
	}

	if (isCancelled()) return { results: [], highlight: [], cancelled: true };

	if (isV5) {
		const missingFileIndices = [
			...new Set(
				[...finalRefs]
					.map((ref) => Number.parseInt(ref.split(":")[0], 10))
					.filter(
						(fileIndex) =>
							isFileAllowed(fileIndex) && !paragraphCache.has(fileIndex),
					),
			),
		];
		let loadedCount = 0;
		const totalMissing = missingFileIndices.length;
		await Promise.all(
			missingFileIndices.map(async (fileIndex) => {
				const fileId = indexData.f?.[fileIndex];
				if (fileId === undefined) return;
				const paragraphs = await loadParagraphsForFile(fileId, sessionsById);
				paragraphCache.set(fileIndex, paragraphs);
				loadedCount++;
				if (!isCancelled()) {
					onProgress(
						50 +
							(totalMissing
								? Math.floor((loadedCount / totalMissing) * 50)
								: 50),
					);
				}
			}),
		);
		if (!totalMissing && !isCancelled()) onProgress(100);
	}

	if (isCancelled()) return { results: [], highlight: [], cancelled: true };

	const groupedResults: Record<string, ResearchResult> = Object.create(null);
	for (const ref of finalRefs) {
		const [docId, paragraphId] = ref.split(":");

		if (!groupedResults[docId]) {
			const doc = buildDocFromRef(
				docId,
				indexData,
				versions,
				libraryTags,
				sessionsById,
				paragraphCache,
			);
			if (doc) groupedResults[docId] = doc;
		}

		const doc = groupedResults[docId];
		if (!doc) continue;

		if (!searchQuery.trim() && doc.isSession) {
			addFilterOnlySessionMatch(doc);
		} else {
			const index = Number.parseInt(paragraphId, 10);
			const text = doc.paragraphs?.[index];
			if (text) doc.matches.push({ index, text });
		}
	}

	Object.values(groupedResults).forEach((doc) => {
		doc.matches.sort(
			(first: ResearchMatch, second: ResearchMatch) =>
				first.index - second.index,
		);
		stripSessionTitleMatches(doc);
	});

	const results = rankResearchResults(
		Object.values(groupedResults).filter((doc) => doc.matches.length > 0),
		searchQuery,
	);

	return { results, highlight: searchTerms };
}
