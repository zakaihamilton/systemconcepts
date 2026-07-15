import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: "http://127.0.0.1:3107",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "yarn start -H 127.0.0.1 -p 3107",
		url: "http://127.0.0.1:3107",
		env: {
			AWS_SECRET: "playwright-internal-secret",
			NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3107",
			PLAYWRIGHT: "1",
			SITE_URL: "http://127.0.0.1:3107",
		},
		reuseExistingServer: false,
		timeout: 120_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
