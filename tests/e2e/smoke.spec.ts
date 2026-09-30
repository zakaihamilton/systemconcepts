import { expect, test } from "@playwright/test";
import { seedLibraryArticle } from "./fixtures/library";

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

test("signs in through the account form and returns to the requested page", async ({
	page,
}) => {
	await page.route("**/api/login", async (route) => {
		const body = route.request().postDataJSON();
		expect(body).toMatchObject({
			action: "login",
			id: "reader@example.test",
			password: "test-password",
		});
		await route.fulfill({ json: { role: "student" } });
	});
	await page.goto("/#account?redirect=groups");
	await page.locator("#username").fill("reader@example.test");
	await page.locator("#password").fill("test-password");
	await page.getByRole("button", { name: "Sign In", exact: true }).click();
	await expect(page).toHaveURL(/#groups$/);
	await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
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
	await seedLibraryArticle(page);

	await page.goto("/#library/id/5c665fb30551dbb6a6615a92");
	await expect(page).toHaveURL(/#library\/id\/5c665fb30551dbb6a6615a92$/);
	await expect(
		page.getByText("Hello from deep-linked article body."),
	).toBeVisible({ timeout: 15000 });
});
