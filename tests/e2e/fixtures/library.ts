import type { Page } from "@playwright/test";

export const ARTICLE_ID = "5c665fb30551dbb6a6615a92";
export const ARTICLE_TEXT = "Hello from deep-linked article body.";

export async function seedLibraryArticle(page: Page) {
	await page.evaluate(async () => {
		const DATABASE_NAME = "systemconcepts-local-files";
		const DATABASE_VERSION = 2;
		const FILE_STORE = "files";
		const METADATA_STORE = "metadata";

		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
			req.onupgradeneeded = () => {
				const database = req.result;
				if (!database.objectStoreNames.contains(FILE_STORE)) {
					database.createObjectStore(FILE_STORE, { keyPath: "path" });
				}
				if (!database.objectStoreNames.contains(METADATA_STORE)) {
					database.createObjectStore(METADATA_STORE, { keyPath: "path" });
				}
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});

		const tx = db.transaction([FILE_STORE, METADATA_STORE], "readwrite");
		const filesStore = tx.objectStore(FILE_STORE);
		const metaStore = tx.objectStore(METADATA_STORE);

		const articleId = "5c665fb30551dbb6a6615a92";
		const tagsData = JSON.stringify([
			{
				_id: articleId,
				book: "Test Book",
				chapter: "Chapter One",
				article: "Deep Link Article",
				number: 1,
				path: "articles/test.json",
			},
		]);
		const articleData = JSON.stringify([
			{
				_id: articleId,
				text: "Hello from deep-linked article body.",
			},
		]);

		const now = Date.now();
		metaStore.put({ path: "/library", type: "dir", mtimeMs: now, size: 0 });
		metaStore.put({
			path: "/library/articles",
			type: "dir",
			mtimeMs: now,
			size: 0,
		});

		metaStore.put({
			path: "/library/tags.json",
			type: "file",
			binary: false,
			size: new Blob([tagsData]).size,
			mtimeMs: now,
		});
		filesStore.put({ path: "/library/tags.json", content: tagsData });

		metaStore.put({
			path: "/library/articles/test.json",
			type: "file",
			binary: false,
			size: new Blob([articleData]).size,
			mtimeMs: now,
		});
		filesStore.put({
			path: "/library/articles/test.json",
			content: articleData,
		});

		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	});
}
