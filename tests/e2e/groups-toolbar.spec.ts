import { expect, test } from "@playwright/test";

test("groups toolbar menu opens on click", async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.clear();
	});

	await page.goto("/#groups");

	const menuButton = page.getByRole("button", { name: /menu/i });
	await expect(menuButton).toBeVisible({ timeout: 15000 });
	await menuButton.click();

	await expect(page.getByRole("menu")).toBeVisible();
});
