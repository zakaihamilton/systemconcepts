import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { makePath } from "@util/data/path";
import { encodeBinaryIndex } from "@util/data/searchIndexBinary";
import { normalizeContent } from "@util/data/string";
import { splitIntoParagraphs } from "@util/domain/splitParagraphs";

const limit = pLimit(20);

export const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"but",
	"by",
	"for",
	"if",
	"in",
	"into",
	"is",
	"it",
	"no",
	"not",
	"of",
	"on",
	"or",
	"such",
	"that",
	"the",
	"their",
	"then",
	"there",
	"these",
	"they",
	"this",
	"to",
	"was",
	"will",
	"with",
	"i",
	"me",
	"my",
	"myself",
	"we",
	"our",
	"ours",
	"ourselves",
	"you",
	"your",
	"yours",
	"yourself",
	"yourselves",
	"he",
	"him",
	"his",
	"himself",
	"she",
	"her",
	"hers",
	"herself",
	"its",
	"itself",
	"them",
	"theirs",
	"themselves",
	"what",
	"which",
	"who",
	"whom",
	"am",
	"were",
	"been",
	"being",
	"have",
	"has",
	"had",
	"having",
	"do",
	"does",
	"did",
	"doing",
	"because",
	"until",
	"while",
	"about",
	"against",
	"between",
	"through",
	"during",
	"before",
	"after",
	"above",
	"below",
	"from",
	"up",
	"down",
	"out",
	"off",
	"over",
	"under",
	"again",
	"further",
	"once",
	"here",
	"when",
	"where",
	"why",
	"how",
	"all",
	"any",
	"both",
	"each",
	"few",
	"more",
	"most",
	"other",
	"some",
	"nor",
	"only",
	"own",
	"same",
	"so",
	"than",
	"too",
	"very",
	"can",
	"just",
	"don",
	"should",
	"now",
]);

export const INDEX_FILE = "search_index.bin";

function addParagraphTokens(newIndex, fileIndex, paragraphs) {
	paragraphs.forEach((para, paraIndex) => {
		const paraTokens = para
			.toLowerCase()
			.split(/[^a-z0-9\u0590-\u05FF]+/)
			.filter(Boolean);
		const uniqueTokens = [...new Set(paraTokens)];
		if (uniqueTokens.length === 0) return;

		uniqueTokens.forEach((token) => {
			if (STOP_WORDS.has(token)) return;
			if (token.length < 3 && !/^\d+$/.test(token)) return;

			if (!newIndex.t[token]) {
				newIndex.t[token] = [];
			}
			newIndex.t[token].push(fileIndex, paraIndex);
		});
	});
}

function compressTokenRefs(newIndex) {
	Object.keys(newIndex.t).forEach((token) => {
		const refs = newIndex.t[token];
		const fileMap = new Map();
		for (let i = 0; i < refs.length; i += 2) {
			const f = refs[i];
			const p = refs[i + 1];
			if (!fileMap.has(f)) fileMap.set(f, []);
			fileMap.get(f).push(p);
		}

		const compressed = [];
		const sortedFiles = Array.from(fileMap.keys()).sort((a, b) => a - b);
		for (const f of sortedFiles) {
			compressed.push(-(f + 1));
			const paras = fileMap.get(f).sort((a, b) => a - b);
			compressed.push(...paras);
		}
		newIndex.t[token] = compressed;
	});
}

async function loadSessionsForIndexing(storage) {
	const sessions = [];
	try {
		const groupsPath = makePath("local/sync/groups.json");
		if (!(await storage.exists(groupsPath))) return sessions;

		const groupsContent = await storage.readFile(groupsPath);
		const groupsData = JSON.parse(groupsContent);
		const groups = Array.isArray(groupsData?.groups) ? groupsData.groups : [];

		for (const group of groups) {
			const safeGroupName = String(group.name).replace(/[./\\]/g, "_");
			const mergedPath = makePath(`local/sync/${safeGroupName}.json`);
			if (await storage.exists(mergedPath)) {
				const content = await storage.readFile(mergedPath);
				const data = JSON.parse(content);
				if (data?.sessions) {
					sessions.push(...data.sessions);
					continue;
				}
			}

			try {
				const listing = await storage.getListing(
					makePath("local/sync", group.name),
				);
				if (listing) {
					const yearFiles = listing.filter((f) => f.name.endsWith(".json"));
					for (const yearFile of yearFiles) {
						const yearPath = makePath("local/sync", group.name, yearFile.name);
						const content = await storage.readFile(yearPath);
						const data = JSON.parse(content);
						if (data?.sessions) {
							sessions.push(...data.sessions);
						}
					}
				}
			} catch (_) {
				// ignore missing dir
			}
		}
	} catch (err) {
		structuredLogger.error("Failed to load sessions for indexing:", err);
	}
	return sessions;
}

/**
 * Build and persist the Research search index (v5 binary).
 * @returns {Promise<{ ok: boolean, reason?: string, index?: object }>}
 */
export async function buildSearchIndex({
	storage,
	translations = {},
	isCancelled = () => false,
	onStatus = () => {},
	onProgress = () => {},
	encodeIndex = encodeBinaryIndex,
} = {}) {
	onStatus(translations.LOADING_TAGS);

	const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
	if (!(await storage.exists(tagsPath))) {
		onStatus(translations.NO_TAGS_FOUND);
		return { ok: false, reason: "NO_TAGS_FOUND" };
	}

	const tagsContent = await storage.readFile(tagsPath);
	const tags = JSON.parse(tagsContent);
	const sessions = await loadSessionsForIndexing(storage);

	const newIndex = {
		v: 5,
		timestamp: Date.now(),
		f: [],
		t: {},
	};

	const tagsByPath = {};
	tags.forEach((tag) => {
		if (!tagsByPath[tag.path]) tagsByPath[tag.path] = [];
		tagsByPath[tag.path].push(tag);
	});

	const uniquePaths = Object.keys(tagsByPath);
	const totalTasks = uniquePaths.length + sessions.length;
	let tasksProcessed = 0;

	const updateProgress = () => {
		tasksProcessed++;
		if (totalTasks > 0) {
			onProgress((tasksProcessed / totalTasks) * 100);
		}
	};

	const processPath = async (path) => {
		if (isCancelled()) return;

		const filePath = makePath(LIBRARY_LOCAL_PATH, path);
		const pathTags = tagsByPath[path];

		try {
			if (await storage.exists(filePath)) {
				const fileContent = await storage.readFile(filePath);
				const data = JSON.parse(fileContent);

				for (const tag of pathTags) {
					let item = null;
					if (Array.isArray(data)) {
						item = data.find((i) => i._id === tag._id);
					} else if (data._id === tag._id) {
						item = data;
					}

					if (item?.text) {
						const paragraphs = splitIntoParagraphs(normalizeContent(item.text));
						if (paragraphs.length > 0) {
							const fileIndex = newIndex.f.length;
							newIndex.f.push(tag._id);
							addParagraphTokens(newIndex, fileIndex, paragraphs);
						}
					}
				}
			}
		} catch (err) {
			structuredLogger.warn(`Failed to index file at ${path}:`, err);
		}
		updateProgress();
	};

	const processSession = async (session) => {
		if (isCancelled()) return;

		const sessionId = `session|${session.group}|${session.year}|${session.date}|${session.name}`;
		let text = `${session.name}\n${session.description || ""}`;

		if (session.summaryText) {
			text += "\n" + session.summaryText;
		} else if (session.summary?.path) {
			const safePath = String(session.summary.path)
				.split(/[/\\]/)
				.filter((segment) => segment !== ".." && segment !== ".")
				.join("/");
			const summaryPath = makePath("local/sync", safePath);
			if (await storage.exists(summaryPath)) {
				const content = await storage.readFile(summaryPath);
				text += "\n" + content;
			}
		}

		const paragraphs = splitIntoParagraphs(normalizeContent(text));
		if (paragraphs.length > 0) {
			const fileIndex = newIndex.f.length;
			newIndex.f.push(sessionId);
			addParagraphTokens(newIndex, fileIndex, paragraphs);
		}
		updateProgress();
	};

	await Promise.all([
		...uniquePaths.map((path) => limit(() => processPath(path))),
		...sessions.map((session) => limit(() => processSession(session))),
	]);

	if (isCancelled()) {
		return { ok: false, reason: "CANCELLED", index: newIndex };
	}

	onStatus(translations.OPTIMIZING_INDEX || "Optimizing index...");
	// Compress refs to v5 negative-file-header format
	compressTokenRefs(newIndex);

	if (isCancelled()) {
		return { ok: false, reason: "CANCELLED", index: newIndex };
	}

	const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
	await storage.createFolderPath(indexPath);

	if (isCancelled()) {
		return { ok: false, reason: "CANCELLED", index: newIndex };
	}

	const binaryData = encodeIndex(newIndex);
	await storage.writeFile(indexPath, binaryData);

	// File is already on disk; treat as success so callers can bump indexTimestamp.
	if (isCancelled()) {
		return { ok: true, index: newIndex, cancelledAfterWrite: true };
	}

	onStatus(translations.DONE);
	return { ok: true, index: newIndex };
}
