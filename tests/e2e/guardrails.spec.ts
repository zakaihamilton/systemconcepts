import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const sizes = [
	{ name: "desktop-1280x800", width: 1280, height: 800 },
	{ name: "mobile-390x844", width: 390, height: 844 },
] as const;

test("home page has no WCAG A/AA violations", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("main").first()).toBeVisible();
	await page.evaluate(() => {
		document
			.getAnimations()
			.filter((animation) =>
				Number.isFinite(animation.effect?.getComputedTiming().endTime),
			)
			.forEach((animation) => {
				animation.finish();
			});
	});
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();
	expect(results.violations).toEqual([]);
});

for (const size of sizes) {
	test(
		"home page matches the reviewed " + size.name + " layout",
		async ({ page }) => {
			test.skip(
				process.platform !== "darwin",
				"Reviewed screenshots run in the macOS visual-regression job.",
			);
			await page.setViewportSize({ width: size.width, height: size.height });
			await page.goto("/");
			await expect(page.locator("main").first()).toBeVisible();
			await expect(page).toHaveScreenshot("home-" + size.name + ".png", {
				fullPage: true,
				animations: "disabled",
				caret: "hide",
			});
		},
	);
}
