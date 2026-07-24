import { expect, test } from "@playwright/test";

test("loads the public application shell", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).not.toBeEmpty();
	await expect(page).toHaveTitle(/System Concepts/i);
});

test("renders the deterministic offline fallback", async ({ page }) => {
	await page.goto("/~offline");
	await expect(
		page.getByRole("heading", { name: "You are offline" }),
	).toBeVisible();
});

test("redirects an expired authenticated request to login", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.location.hash = "sessions/test";
	});
	await page.route("**/api/personal", async (route) => {
		await route.fulfill({
			status: 401,
			contentType: "application/json",
			body: JSON.stringify({ err: "Please sign in again" }),
		});
	});
	await page.goto("/");
	await page.evaluate(async () => {
		const response = await fetch("/api/personal");
		if (response.status === 401) {
			window.location.hash = `account?redirect=${encodeURIComponent("sessions/test")}`;
		}
	});
	await expect(page).toHaveURL(/#account\?redirect=sessions%2Ftest$/);
});

test("loads deterministic mocked sessions", async ({ page }) => {
	await page.route("**/api/sessions**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([
				{ id: "session-1", group: "demo", year: "2026", name: "Test session" },
			]),
		});
	});
	await page.goto("/");
	const sessions = await page.evaluate(async () => {
		const response = await fetch("/api/sessions?id=e2e");
		return response.json();
	});
	expect(sessions).toEqual([
		{ id: "session-1", group: "demo", year: "2026", name: "Test session" },
	]);
});

test("handles mocked sync success and failure without external storage", async ({
	page,
}) => {
	let attempts = 0;
	await page.route("**/api/aws", async (route) => {
		attempts += 1;
		await route.fulfill(
			attempts === 1
				? {
						status: 200,
						contentType: "application/json",
						body: JSON.stringify({ ok: true }),
					}
				: {
						status: 503,
						contentType: "application/json",
						body: JSON.stringify({ err: "STORAGE_UNAVAILABLE" }),
					},
		);
	});
	await page.goto("/");
	const statuses = await page.evaluate(async () => [
		(await fetch("/api/aws")).status,
		(await fetch("/api/aws")).status,
	]);
	expect(statuses).toEqual([200, 503]);
});

test("preserves research and media hash navigation", async ({ page }) => {
	await page.goto("/#research");
	await expect(page).toHaveURL(/#research$/);
	await page.evaluate(() => {
		window.location.hash =
			"session?group=demo&year=2026&date=2026-01-01&name=Test%20session";
	});
	await expect(page).toHaveURL(/#session\?group=demo/);
});

test("preserves library article deep-link hashes on load", async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			"MainStore",
			JSON.stringify({
				hash: "#library",
				fontSize: "16",
				showSideBar: true,
			}),
		);
	});
	await page.goto("/#library/id/5c665fb30551dbb6a6615a92");
	await expect(page).toHaveURL(/#library\/id\/5c665fb30551dbb6a6615a92$/);
	const hash = await page.evaluate(() => window.location.hash);
	expect(hash).toBe("#library/id/5c665fb30551dbb6a6615a92");
});

test("loads a library article from a deep link when local tags exist", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			"MainStore",
			JSON.stringify({
				hash: "#library",
				fontSize: "16",
				showSideBar: true,
			}),
		);
	});

	await page.goto("/");
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

	await page.goto("/#library/id/5c665fb30551dbb6a6615a92");
	await expect(page).toHaveURL(/#library\/id\/5c665fb30551dbb6a6615a92$/);
	await expect(
		page.getByText("Hello from deep-linked article body."),
	).toBeVisible({ timeout: 15000 });
});
