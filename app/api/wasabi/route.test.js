import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { getDownloadUrl, handleRequest } from "@util/storage/wasabi";
import { GET } from "./route";

jest.mock("@util/auth/session", () => ({
	getSessionUser: jest.fn(),
}));
jest.mock("@util/auth/roles", () => ({
	roleAuth: jest.fn(),
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err?.message || err)),
}));
jest.mock("@util/storage/wasabi", () => ({
	getDownloadUrl: jest.fn(),
	handleRequest: jest.fn(),
}));
jest.mock("next/server", () => {
	class TestHeaders {
		constructor(values = {}) {
			this.values = new Map(
				Object.entries(values).map(([key, value]) => [
					key.toLowerCase(),
					String(value),
				]),
			);
		}

		get(name) {
			return this.values.get(name.toLowerCase()) ?? null;
		}
	}

	class TestResponse {
		constructor(body, init = {}) {
			this.body = body;
			this.status = init.status || 200;
			this.headers = new TestHeaders(init.headers);
		}

		async json() {
			return JSON.parse(this.body);
		}

		static json(body, init = {}) {
			return new TestResponse(JSON.stringify(body), init);
		}

		static redirect(url, init = {}) {
			return new TestResponse(null, {
				...init,
				headers: { ...init.headers, Location: url },
			});
		}
	}

	return { NextResponse: TestResponse };
});

function request(query = "", cookie = "id=user; hash=secret") {
	const headers = new Map([["cookie", cookie]]);
	return {
		url: `https://systemconcepts.app/api/wasabi${query}`,
		headers: {
			get: (name) => headers.get(name.toLowerCase()) || null,
			entries: () => headers.entries(),
		},
	};
}

describe("/api/wasabi", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "user", role: "student" });
		roleAuth.mockReturnValue(true);
		getDownloadUrl.mockResolvedValue(
			"https://s3.wasabisys.com/bucket/sessions/test/file.txt?signature=test",
		);
	});

	it.each([
		["text", "?path=sessions%2Ftest%2Ffile.txt&type=file"],
		["binary", "?path=sessions%2Ftest%2Ffile.mp4&binary=true"],
	])("redirects authenticated %s file reads to Wasabi", async (_, query) => {
		const response = await GET(request(query));

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toContain("s3.wasabisys.com");
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(getDownloadUrl).toHaveBeenCalledWith({
			path: expect.stringMatching(/^sessions\/test\/file\./),
		});
		expect(handleRequest).not.toHaveBeenCalled();
	});

	it("keeps directory listings in the API route", async () => {
		handleRequest.mockResolvedValue([{ name: "file.txt", type: "file" }]);

		const response = await GET(request("?path=sessions%2Ftest&type=dir"));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual([
			{ name: "file.txt", type: "file" },
		]);
		expect(handleRequest).toHaveBeenCalled();
		expect(getDownloadUrl).not.toHaveBeenCalled();
	});

	it("keeps existence checks in the API route", async () => {
		handleRequest.mockResolvedValue({ name: "file.txt", type: "file" });

		const response = await GET(
			request("?path=sessions%2Ftest%2Ffile.txt&exists=true"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			name: "file.txt",
			type: "file",
		});
		expect(getDownloadUrl).not.toHaveBeenCalled();
	});

	it("does not sign a URL when credentials are missing", async () => {
		getSessionUser.mockRejectedValue("ACCESS_DENIED");

		const response = await GET(request("?path=sessions%2Ftest%2Ffile.txt", ""));

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(getDownloadUrl).not.toHaveBeenCalled();
	});

	it("does not sign a URL for unauthorized users", async () => {
		roleAuth.mockReturnValue(false);

		const response = await GET(request("?path=sessions%2Ftest%2Ffile.txt"));

		expect(response.status).toBe(403);
		expect(getDownloadUrl).not.toHaveBeenCalled();
	});
});
