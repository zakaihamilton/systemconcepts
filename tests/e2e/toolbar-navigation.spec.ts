import { expect, test } from "@playwright/test";

test("toolbar works after opening menu and navigating away", async ({
	page,
}) => {
	await page.goto("/#groups");

	const menuButton = page.getByRole("button", { name: /menu/i });
	await menuButton.click();
	await expect(page.getByRole("menu")).toBeVisible();

	await page.goto("/#sessions");
	await page.waitForTimeout(1000);

	const syncButton = page.getByRole("button", { name: /sync/i }).first();
	await expect(syncButton).toBeVisible({ timeout: 15000 });
	await syncButton.click();
});
