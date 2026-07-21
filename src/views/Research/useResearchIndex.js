import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { SyncActiveStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { decodeBinaryIndex } from "@util/data/searchIndexBinary";
import { collator } from "@util/data/sort";
import storage from "@util/storage/storage";
import { LibraryTagKeys } from "@views/Library/Icons";
import { LibraryStore } from "@views/Library/Store";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const INDEX_FILE = "search_index.bin";
const LEGACY_INDEX_FILE = "search_index.json";

/**
 * Loads the research search index, filter tags, and session-derived metadata.
 * @param {{ sessions: unknown[] | null | undefined, translations: Record<string, string>, indexTimestamp: unknown }} params
 */
export function useResearchIndex({ sessions, translations, indexTimestamp }) {
	const [indexData, setIndexData] = useState(null);
	const [availableFilters, setAvailableFilters] = useState([]);
	const libraryUpdateCounter = SyncActiveStore.useState(
		(s) => s.libraryUpdateCounter,
	);
	const isMounted = useRef(true);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const loadTags = useCallback(async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const tagsContent = await storage.readFile(tagsPath);
				const tags = JSON.parse(tagsContent);
				const unique = new Set();
				tags.forEach((tag) => {
					LibraryTagKeys.forEach((key) => {
						if (tag[key]) {
							const label = String(tag[key]).trim();
							unique.add(JSON.stringify({ label, type: key }));
						}
					});
				});

				if (sessions) {
					const capitalize = (s) => {
						if (!s) return "";
						const str = String(s);
						if (str.toLowerCase() === "ai") return "AI";
						return str.charAt(0).toUpperCase() + str.slice(1);
					};
					sessions.forEach((session) => {
						if (session.group)
							unique.add(
								JSON.stringify({
									label: capitalize(session.group),
									type: "group",
								}),
							);
						if (session.year)
							unique.add(JSON.stringify({ label: session.year, type: "year" }));
						if (session.type)
							unique.add(
								JSON.stringify({
									label: capitalize(session.type),
									type: "type",
								}),
							);
					});
				}
				unique.add(
					JSON.stringify({
						label: translations.SESSIONS,
						type: "source",
						id: "SESSIONS",
					}),
				);
				unique.add(
					JSON.stringify({
						label: translations.ARTICLES,
						type: "source",
						id: "ARTICLES",
					}),
				);
				unique.add(
					JSON.stringify({
						label: translations.SUMMARIES,
						type: "source",
						id: "SUMMARIES",
					}),
				);

				if (isMounted.current) {
					const filters = Array.from(unique).map((s) => JSON.parse(s));
					filters.sort((a, b) => collator.compare(a.label, b.label));
					setAvailableFilters(filters);
					LibraryStore.update((s) => {
						s.tags = tags;
					});
				}
			}
		} catch (err) {
			structuredLogger.error("Failed to load tags for filters:", err);
		}
	}, [sessions, translations]);

	const buildIndex = useCallback(async () => {
		ResearchStore.update((s) => {
			s.indexing = true;
		});
	}, []);

	const loadIndex = useCallback(async () => {
		try {
			const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
			if (await storage.exists(indexPath)) {
				const content = await storage.readFile(indexPath);
				const data = decodeBinaryIndex(content);
				if (isMounted.current) {
					setIndexData(data);
				}
			} else {
				// Try legacy JSON format for migration
				const legacyPath = makePath(LIBRARY_LOCAL_PATH, LEGACY_INDEX_FILE);
				if (await storage.exists(legacyPath)) {
					const content = await storage.readFile(legacyPath);
					const data = JSON.parse(content);
					if (isMounted.current) {
						setIndexData(data);
					}
				} else {
					// Auto-build if not exists
					buildIndex();
				}
			}
		} catch (err) {
			structuredLogger.error("Failed to load search index:", err);
			// If the index is corrupted, delete it and rebuild
			try {
				const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
				if (await storage.exists(indexPath)) {
					await storage.deleteFile(indexPath);
					structuredLogger.debug(
						"Deleted corrupted search index, rebuilding...",
					);
					buildIndex();
				}
			} catch (deleteErr) {
				structuredLogger.error("Failed to delete corrupted index:", deleteErr);
			}
		}
	}, [buildIndex]);

	useEffect(() => {
		loadTags();
		loadIndex();
	}, [loadTags, loadIndex, indexTimestamp, sessions]);

	useEffect(() => {
		if (libraryUpdateCounter > 0) {
			loadIndex();
			loadTags();
		}
	}, [libraryUpdateCounter, loadIndex, loadTags, sessions]);

	const sessionsById = useMemo(() => {
		if (!sessions) {
			return new Map();
		}
		return sessions.reduce((map, session) => {
			const sessionId = `session|${session.group}|${session.year}|${session.date}|${session.name}`;
			map.set(sessionId, session);
			return map;
		}, new Map());
	}, [sessions]);

	const indexedTerms = useMemo(() => {
		const dictionary = indexData?.t || indexData?.tokens || {};
		return Object.keys(dictionary).slice(0, 5000);
	}, [indexData]);

	return {
		indexData,
		availableFilters,
		sessionsById,
		indexedTerms,
		buildIndex,
		loadIndex,
		loadTags,
	};
}
