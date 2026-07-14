import {
	isProductionDeployment,
	shouldRedirectStorageFileRead,
} from "./storageRedirect";

function request({
	method = "GET",
	host = "systemconcepts.app",
	headers = {},
} = {}) {
	return {
		method,
		headers: {
			get: (name) => {
				if (name === "host") return host;
				return headers[name] ?? null;
			},
		},
	};
}

describe("storageRedirect", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.VERCEL_ENV;
		delete process.env.SITE_URL;
		delete process.env.NEXT_PUBLIC_SITE_URL;
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("treats Vercel production deployments as production", () => {
		process.env.VERCEL_ENV = "production";

		expect(
			isProductionDeployment(
				request({ host: "systemconcepts-git-main.vercel.app" }),
			),
		).toBe(true);
	});

	it("treats the production site host as production", () => {
		expect(isProductionDeployment(request())).toBe(true);
		expect(
			isProductionDeployment(request({ host: "www.systemconcepts.app" })),
		).toBe(true);
	});

	it("does not treat preview hosts as production", () => {
		expect(
			isProductionDeployment(
				request({
					host: "systemconcepts-git-refactor-remove-mui-zakai-hamiltons-projects.vercel.app",
				}),
			),
		).toBe(false);
	});

	it("redirects file reads only in production", () => {
		process.env.VERCEL_ENV = "production";

		expect(
			shouldRedirectStorageFileRead(request(), { path: "sync/files.json.gz" }),
		).toBe(true);
		expect(
			shouldRedirectStorageFileRead(request(), {
				path: "sync",
				type: "dir",
			}),
		).toBe(false);
		expect(
			shouldRedirectStorageFileRead(request(), {
				path: "sync/files.json.gz",
				exists: "true",
			}),
		).toBe(false);
	});

	it("proxies file reads outside production", () => {
		expect(
			shouldRedirectStorageFileRead(
				request({
					host: "systemconcepts-git-refactor-remove-mui-zakai-hamiltons-projects.vercel.app",
				}),
				{ path: "sync/files.json.gz" },
			),
		).toBe(false);
	});
});
