import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import { ARTICLE_ID, ARTICLE_TEXT } from "./fixtures/library";

async function prepareSync(page: Page) {
	await page.context().addCookies(
		["id", "hash", "role"].map((name) => ({
			name,
			value:
				name === "role" ? "student" : name === "id" ? "reader" : "test-session",
			url: "http://127.0.0.1:3107",
		})),
	);
	await page.addInitScript(() => {
		localStorage.setItem("sync_autoSync", "false");
		localStorage.setItem("sync_locked", "true");
	});
}

test("manual sync downloads library content that can be opened in the UI", async ({
	page,
}) => {
	await prepareSync(page);
	const files: Record<string, unknown> = {
		"sync/files.json.gz": [],
		"library/files.json.gz": [
			{ path: "/tags.json", version: 1 },
			{ path: "/articles/test.json", version: 1 },
		],
		"library/tags.json.gz": [
			{
				_id: ARTICLE_ID,
				book: "Test Book",
				chapter: "Chapter One",
				article: "Deep Link Article",
				number: 1,
				path: "articles/test.json",
			},
		],
		"library/articles/test.json.gz": [{ _id: ARTICLE_ID, text: ARTICLE_TEXT }],
		"personal/reader/files.json.gz": [{ path: "/migration.json", version: 1 }],
		"personal/reader/migration.json.gz": { complete: true },
	};
	const reads: string[] = [];
	await page.route("**/api/aws?**", async (route) => {
		const path = new URL(route.request().url()).searchParams.get("path") || "";
		reads.push(path);
		if (!(path in files)) {
			await route.fulfill({ status: 404 });
			return;
		}
		await route.fulfill({
			contentType: path.endsWith(".gz")
				? "application/gzip"
				: "application/json",
			body: path.endsWith(".gz")
				? gzipSync(JSON.stringify(files[path]))
				: JSON.stringify(files[path]),
		});
	});
	await page.route("**/api/passkey?**", (route) => route.fulfill({ json: [] }));
	await page.goto("/#sync");
	const sync = page.getByRole("button", { name: "Sync", exact: true });
	await expect(sync).toBeEnabled();
	await sync.click();
	await expect(page.getByText(/Library sync complete/)).toBeVisible();
	await expect(page.getByText(/Personal sync complete/)).toBeVisible();
	await expect(sync).toBeEnabled();
	expect(reads).toEqual(
		expect.arrayContaining([
			"library/tags.json.gz",
			"library/articles/test.json.gz",
		]),
	);
	await expect
		.poll(() =>
			page.evaluate(() =>
				Number(localStorage.getItem("sync_lastSyncTime:reader")),
			),
		)
		.toBeGreaterThan(0);
	await page.goto(`/#library/id/${ARTICLE_ID}`);
	await expect(page.getByText(ARTICLE_TEXT)).toBeVisible();
});

test("manual sync reports storage failure and allows a retry", async ({
	page,
}) => {
	await prepareSync(page);
	await page.route("**/api/aws?**", (route) =>
		route.fulfill({ status: 503, json: { err: "STORAGE_UNAVAILABLE" } }),
	);
	await page.goto("/#sync");
	const sync = page.getByRole("button", { name: "Sync", exact: true });
	await sync.click();
	await expect(page.getByText(/Sync failed:/)).toBeVisible();
	await expect(sync).toBeEnabled();
	await expect(page.getByText("Complete", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Never", { exact: true })).toBeVisible();
});

test("an expired storage session redirects through the app to the sign-in form", async ({
	page,
}) => {
	await prepareSync(page);
	await page.route("**/api/aws?**", (route) =>
		route.fulfill({ status: 401, json: { err: "Please sign in again" } }),
	);
	await page.goto("/#sync");
	await page.getByRole("button", { name: "Sync", exact: true }).click();
	await expect(page).toHaveURL(/#account\?redirect=sync$/);
	await expect(page.locator("#username")).toBeVisible();
	await expect(page.locator("#password")).toBeVisible();
	expect(
		(await page.context().cookies()).filter((cookie) =>
			["id", "hash", "role"].includes(cookie.name),
		),
	).toEqual([]);
});
