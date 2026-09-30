import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { useCallback, useEffect } from "react";

const fileCache = new Map<any, any>();

type UseLibraryFilesOptions = {
	selectedTag: any;
	setContent: (content: any) => void;
	setLoading: (loading: boolean) => void;
	setTags: (tags: any) => void;
	setCustomOrder: (order: Record<string, any>) => void;
	libraryUpdateCounter: number;
};

export function useLibraryFiles({
	selectedTag,
	setContent,
	setLoading,
	setTags,
	setCustomOrder,
	libraryUpdateCounter,
}: UseLibraryFilesOptions) {
	const loadTags = useCallback(async () => {
		try {
			const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
			if (await storage.exists(tagsPath)) {
				const fileContents = await storage.readFile(tagsPath);
				const data = JSON.parse(fileContents);
				setTags(Array.isArray(data) ? data : []);
			}
		} catch (err: any) {
			structuredLogger.error("Failed to load library tags:", err);
		}
	}, [setTags]);

	const loadCustomOrder = useCallback(async () => {
		try {
			const orderPath = makePath(LIBRARY_LOCAL_PATH, "library-order.json");
			if (await storage.exists(orderPath)) {
				const fileContents = await storage.readFile(orderPath);
				const data = JSON.parse(fileContents);
				setCustomOrder(data);
			}
		} catch (err: any) {
			structuredLogger.error("Failed to load library order:", err);
		}
	}, [setCustomOrder]);

	useEffect(() => {
		setTimeout(() => {
			loadTags();
			loadCustomOrder();
		}, 0);
	}, [loadTags, loadCustomOrder]);

	const loadContent = useCallback(async () => {
		if (!selectedTag) {
			setContent(null);
			return;
		}

		setLoading(true);
		setContent(null);
		await new Promise((r) => setTimeout(r, 0));

		try {
			const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
			let data;

			if (fileCache.has(filePath)) {
				data = fileCache.get(filePath);
			} else if (await storage.exists(filePath)) {
				const fileContent = await storage.readFile(filePath);
				data = JSON.parse(fileContent);
				fileCache.set(filePath, data);
			} else {
				setContent("File not found.");
				return;
			}

			let item = null;
			if (Array.isArray(data)) {
				item = data.find((i) => String(i._id) === String(selectedTag._id));
			} else if (String(data._id) === String(selectedTag._id)) {
				item = data;
			}

			const contentText = item ? item.text || "" : "Content not found in file.";
			setContent(contentText);
		} catch (err: any) {
			structuredLogger.error("Failed to load content:", err);
			setContent("Error loading content.");
		} finally {
			setLoading(false);
		}
	}, [selectedTag, setContent, setLoading]);

	useEffect(() => {
		setTimeout(() => loadContent(), 0);
	}, [loadContent]);

	useEffect(() => {
		if (libraryUpdateCounter > 0) {
			// Clear caches when library is updated

			setTimeout(() => {
				fileCache.clear();
				loadTags();
				loadCustomOrder();
				loadContent();
			}, 0);
		}
	}, [libraryUpdateCounter, loadTags, loadCustomOrder, loadContent]);

	return { loadContent };
}
