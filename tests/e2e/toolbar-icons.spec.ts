import { expect, test } from "@playwright/test";

test("sync toolbar button responds to click", async ({ page }) => {
	await page.goto("/#groups");

	const syncButton = page.getByRole("button", { name: /sync/i }).first();
	await expect(syncButton).toBeVisible({ timeout: 15000 });
	await syncButton.click();
});

test("table view toggle responds to click on groups page", async ({ page }) => {
	await page.goto("/#groups");

	const listViewButton = page.getByRole("button", { name: /list view/i });
	await expect(listViewButton).toBeVisible({ timeout: 15000 });
	await listViewButton.click();
	await expect(listViewButton).toHaveClass(/selected/);
});

test("overflow menu item runs its action", async ({ page }) => {
	await page.goto("/#groups");

	const menuButton = page.getByRole("button", { name: /menu/i });
	await menuButton.click();

	const importItem = page.getByRole("menu").getByText(/import groups/i);
	await expect(importItem).toBeVisible();
	await importItem.click();

	await expect(page.getByRole("menu")).toHaveCount(0);
});
