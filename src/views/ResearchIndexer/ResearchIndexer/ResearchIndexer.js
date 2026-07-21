import { logger as structuredLogger } from "@util/api/logger";
import { useLocalStorage } from "@util/browser/store";
import { useTranslations } from "@util/domain/translations";
import storage from "@util/storage/storage";
import { useCallback, useEffect, useRef } from "react";
import { ResearchStore } from "../../ResearchStore/ResearchStore";
import { buildSearchIndex } from "../buildSearchIndex";

export default function ResearchIndexer() {
	const translations = useTranslations();
	const { indexing } = ResearchStore.useState();
	const isMounted = useRef(true);
	const inProgress = useRef(false);
	useLocalStorage("ResearchStore", ResearchStore, [
		"query",
		"filterTags",
		"source",
	]);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const buildIndex = useCallback(async () => {
		if (inProgress.current) return;
		inProgress.current = true;

		ResearchStore.update((s) => {
			s.progress = 0;
			s.status = translations.LOADING_TAGS;
		});

		try {
			const result = await buildSearchIndex({
				storage,
				translations,
				isCancelled: () => !isMounted.current,
				onStatus: (status) => {
					if (!isMounted.current) return;
					ResearchStore.update((s) => {
						s.status = status;
					});
				},
				onProgress: (progressVal) => {
					if (!isMounted.current) return;
					ResearchStore.update((s) => {
						s.progress = progressVal;
					});
				},
			});

			if (!result.ok && result.reason === "NO_TAGS_FOUND") {
				ResearchStore.update((s) => {
					if (isMounted.current) {
						s.status = translations.NO_TAGS_FOUND;
					}
					s.indexing = false;
				});
				return;
			}

			if (result.ok) {
				// Always bump timestamp so Research reloads even if we unmounted mid-write.
				ResearchStore.update((s) => {
					if (isMounted.current && !result.cancelledAfterWrite) {
						s.status = translations.DONE;
					}
					s.indexTimestamp = Date.now();
				});
			}
		} catch (err) {
			structuredLogger.error("Indexing failed:", err);
			if (isMounted.current) {
				ResearchStore.update((s) => {
					s.status = translations.INDEXING_FAILED;
				});
			}
		} finally {
			inProgress.current = false;
			// Clear indexing even after unmount so a remount does not stick on the overlay.
			ResearchStore.update((s) => {
				s.indexing = false;
			});
			if (isMounted.current) {
				setTimeout(() => {
					if (isMounted.current) {
						ResearchStore.update((s) => {
							s.status = "";
						});
					}
				}, 2000);
			}
		}
	}, [translations]);

	useEffect(() => {
		if (indexing && !inProgress.current) {
			buildIndex();
		}
	}, [indexing, buildIndex]);

	return null;
}
