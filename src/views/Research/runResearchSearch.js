import { loadParagraphsForFile as defaultLoadParagraphs } from "@util/domain/loadParagraphs";
import { getAllowedResearchFileIndices } from "./searchFilters";
import {
	clauseMatchesText,
	getSearchTerms,
	parseResearchQuery,
	rankResearchResults,
} from "./searchQuery";

const capitalize = (s) => {
	if (!s) return "";
	const str = String(s);
	if (str.toLowerCase() === "ai") return "AI";
	return str.charAt(0).toUpperCase() + str.slice(1);
};

const normalize = (s) =>
	String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

function expandTokenRefs(refs, { isV3, isV4, isV5 }) {
	const tokenRefs = new Set();
	if (!refs) return tokenRefs;
	if (isV4 || isV5) {
		let currentFileIndex = -1;
		for (let i = 0; i < refs.length; i++) {
			const val = refs[i];
			if (val < 0) {
				currentFileIndex = -val - 1;
			} else if (currentFileIndex !== -1) {
				tokenRefs.add(`${currentFileIndex}:${val}`);
			}
		}
	} else if (isV3) {
		for (let i = 0; i < refs.length; i += 2) {
			tokenRefs.add(`${refs[i]}:${refs[i + 1]}`);
		}
	} else {
		refs.forEach((ref) => tokenRefs.add(ref));
	}
	return tokenRefs;
}

function buildDocFromRef(
	docId,
	indexData,
	versions,
	libraryTags,
	sessionsById,
	paragraphsMap,
) {
	const { isV2, isV3, isV4, isV5 } = versions;
	if (isV3 || isV2 || isV4 || isV5) {
		const fileIndex = parseInt(docId, 10);
		const tagId = indexData.f[fileIndex];
		const paragraphs = isV5
			? paragraphsMap.get(fileIndex)
			: indexData.d[fileIndex];

		if (tagId.startsWith("session|")) {
			const parts = tagId.split("|");
			if (parts.length >= 5) {
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
			return null;
		}

		const tag = libraryTags.find((t) => t._id === tagId);
		if (tag) {
			return {
				docId: tagId,
				tag,
				paragraphs,
				matches: [],
			};
		}
		return null;
	}

	const v1Doc = indexData.files[docId];
	if (v1Doc) {
		return {
			...v1Doc,
			docId,
			matches: [],
		};
	}
	return null;
}

function addFilterOnlySessionMatch(doc) {
	if (doc.matches.length > 0) return;

	let summaryText = doc.summary || doc.description;
	let useParagraphs = !summaryText;

	if (summaryText && doc.tag) {
		const pText = normalize(summaryText);
		const tText = normalize(doc.tag.title);
		if (pText === tText || pText.includes(tText) || tText.includes(pText)) {
			useParagraphs = true;
		}
	}

	if (useParagraphs && doc.paragraphs?.length > 0) {
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
			const p0 = doc.paragraphs[0];
			const tText = doc.tag ? normalize(doc.tag.title) : "";
			const p0Norm = normalize(p0);
			if (p0Norm !== tText && !p0Norm.includes(tText)) {
				summaryText = p0;
			}
		}
	}

	summaryText = summaryText || "";
	doc.paragraphs = [summaryText];
	doc.matches.push({
		index: 0,
		text: summaryText,
	});
}

function stripSessionTitleMatches(doc) {
	if (!doc.isSession || !doc.tag || doc.matches.length === 0) return;
	const tText = normalize(doc.tag.title);
	const m0 = doc.matches[0];
	if (m0.index !== 0) return;
	const pText = normalize(m0.text);
	if (pText === tText || pText.includes(tText) || tText.includes(pText)) {
		doc.matches.shift();
		if (doc.matches.length === 0 && doc.paragraphs?.length > 1) {
			doc.matches.push({
				index: 1,
				text: doc.paragraphs[1],
			});
		}
	}
}

/**
 * Run a Research search against a decoded index.
 * Pure of React; callers supply cancellation and progress hooks.
 */
export async function runResearchSearch({
	indexData,
	searchQuery = "",
	sessionsById = new Map(),
	libraryTags = [],
	filterTags = [],
	translations = {},
	loadParagraphsForFile = defaultLoadParagraphs,
	isCancelled = () => false,
	onProgress = () => {},
} = {}) {
	if (!indexData) {
		return { results: [], highlight: [] };
	}

	const orGroups = parseResearchQuery(searchQuery);
	const searchTerms = getSearchTerms(searchQuery);
	let finalRefs = new Set();
	const paragraphCache = new Map();

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
	const isFileAllowed = (fileIndex) =>
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
				...new Set(parsedAndClauses.flatMap((c) => c.terms)),
			];
			let groupRefs = null;

			for (const token of allTokensInGroup) {
				if (isCancelled())
					return { results: [], highlight: [], cancelled: true };

				const matchingTokens = Object.keys(
					indexData.t || indexData.tokens || {},
				).filter((k) => k.includes(token));
				let tokenRefs = new Set();
				matchingTokens.forEach((k) => {
					const refs =
						isV2 || isV3 || isV4 || isV5 ? indexData.t[k] : indexData.tokens[k];
					expandTokenRefs(refs, versions).forEach((ref) => {
						const fileIndex = parseInt(ref.split(":")[0], 10);
						if (isFileAllowed(fileIndex)) tokenRefs.add(ref);
					});
				});

				if (groupRefs === null) {
					groupRefs = tokenRefs;
				} else {
					groupRefs = new Set([...groupRefs].filter((x) => tokenRefs.has(x)));
				}
			}

			if (groupRefs) {
				if (isV5) {
					const uniqueFileIndices = new Set();
					[...groupRefs].forEach((ref) => {
						const [docId] = ref.split(":");
						uniqueFileIndices.add(parseInt(docId, 10));
					});

					const fileIndicesArray = [...uniqueFileIndices];
					let loadedCount = 0;
					const totalFiles = fileIndicesArray.length;

					await Promise.all(
						fileIndicesArray.map(async (fileIndex) => {
							if (!paragraphCache.has(fileIndex)) {
								const fileId = indexData.f[fileIndex];
								const paragraphs = await loadParagraphsForFile(
									fileId,
									sessionsById,
								);
								paragraphCache.set(fileIndex, paragraphs);
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

				[...groupRefs].forEach((ref) => {
					const [docId, paraIndex] = ref.split(":");
					let paragraph = null;
					if (isV5) {
						const fileIndex = parseInt(docId, 10);
						const paragraphs = paragraphCache.get(fileIndex);
						paragraph = paragraphs?.[parseInt(paraIndex, 10)];
					} else if (isV3 || isV2 || isV4) {
						const fileIndex = parseInt(docId, 10);
						paragraph = indexData.d[fileIndex]?.[parseInt(paraIndex, 10)];
					} else {
						const doc = indexData.files[docId];
						paragraph = doc?.paragraphs?.[parseInt(paraIndex, 10)];
					}

					if (paragraph) {
						const isMatch = parsedAndClauses.every((clause) =>
							clauseMatchesText(clause, paragraph),
						);
						if (isMatch) finalRefs.add(ref);
					}
				});
			}
		}
	}

	if (isCancelled()) return { results: [], highlight: [], cancelled: true };

	if (isV5) {
		const missingFileIndices = [
			...new Set(
				[...finalRefs]
					.map((ref) => parseInt(ref.split(":")[0], 10))
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
				const paragraphs = await loadParagraphsForFile(
					indexData.f[fileIndex],
					sessionsById,
				);
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

	const groupedResults = {};
	[...finalRefs].forEach((ref) => {
		const [docId, paraIndex] = ref.split(":");

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

		if (!groupedResults[docId]) return;

		if (!searchQuery.trim() && groupedResults[docId].isSession) {
			addFilterOnlySessionMatch(groupedResults[docId]);
		} else {
			const idx = parseInt(paraIndex, 10);
			if (groupedResults[docId].paragraphs?.[idx]) {
				groupedResults[docId].matches.push({
					index: idx,
					text: groupedResults[docId].paragraphs[idx],
				});
			}
		}
	});

	Object.values(groupedResults).forEach((doc) => {
		doc.matches.sort((a, b) => a.index - b.index);
		stripSessionTitleMatches(doc);
	});

	const results = rankResearchResults(
		Object.values(groupedResults).filter((doc) => doc.matches.length > 0),
		searchQuery,
	);

	return { results, highlight: searchTerms };
}
