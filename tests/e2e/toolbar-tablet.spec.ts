import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 800, height: 900 } });

test("tablet-width toolbar overflow menu opens", async ({ page }) => {
	await page.goto("/#groups");

	const menuButton = page.getByRole("button", { name: /menu/i });
	await expect(menuButton).toBeVisible({ timeout: 15000 });
	await menuButton.click();
	await expect(page.getByRole("menu")).toBeVisible();
});

test("tablet-width sessions filter is in header toolbar", async ({ page }) => {
	await page.goto("/#sessions");

	const filterButton = page.getByRole("button", { name: /filter/i });
	await expect(filterButton).toBeVisible({ timeout: 15000 });
	await filterButton.click();
});

test("tablet-width rows per page button opens submenu when visible", async ({
	page,
}) => {
	await page.goto("/#groups");

	const rowsButton = page.getByRole("button", { name: /rows per page/i });
	const isVisible = await rowsButton.isVisible().catch(() => false);
	test.skip(!isVisible, "Rows per page requires table view with 10+ groups");

	await rowsButton.click();
	await expect(page.getByRole("menu").getByText("25")).toBeVisible();
});
