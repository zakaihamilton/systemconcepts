import { expect, test } from "@playwright/test";
import {
	ARTICLE_ID,
	ARTICLE_TEXT,
	seedLibraryArticle,
} from "./fixtures/library";

test.use({ serviceWorkers: "allow" });

test("reopens a saved article and navigates to an unvisited view after an offline reload", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await seedLibraryArticle(page);
	// A hash-only navigation does not acquire a controller; navigate the document.
	await page.reload();
	await page.goto(`/#library/id/${ARTICLE_ID}`);
	await expect(page.getByText(ARTICLE_TEXT)).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
		)
		.toBe(true);
	await context.setOffline(true);
	try {
		await page.reload();
		await expect(page.getByText(ARTICLE_TEXT)).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`#library/id/${ARTICLE_ID}$`));
		await expect(
			page.getByRole("heading", { name: "You are offline" }),
		).toHaveCount(0);
		// This view was never loaded online: its dynamic chunk must be precached.
		await page.goto("/#account");
		await expect(page.locator("#username")).toBeVisible();
		await expect(page.locator("#password")).toBeVisible();
	} finally {
		await context.setOffline(false);
	}
});
