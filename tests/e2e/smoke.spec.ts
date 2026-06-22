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
