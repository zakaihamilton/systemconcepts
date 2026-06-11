import parseCookie from "@util/api/cookie";
import { login } from "@util/auth/login";
import { roleAuth } from "@util/auth/roles";
import { getS3, list } from "@util/storage/aws";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GET } from "./route";

jest.mock("@util/api/cookie", () => jest.fn());
jest.mock("@util/auth/login", () => ({
	login: jest.fn(),
}));
jest.mock("@util/auth/roles", () => ({
	roleAuth: jest.fn(),
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err?.message || err)),
}));
jest.mock("@util/storage/aws", () => ({
	getS3: jest.fn(),
	list: jest.fn(),
	validatePathAccess: jest.fn(),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: jest.fn(),
}));
jest.mock("@aws-sdk/client-s3", () => ({
	GetObjectCommand: jest.fn().mockImplementation((params) => params),
}));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			status: init.status || 200,
			json: async () => body,
			headers: {
				get: (name) => init.headers?.get?.(name) || null,
			},
		}),
	},
}));

function request(url, cookie = "id=user; hash=secret") {
	return {
		url,
		headers: {
			get: (name) => (name.toLowerCase() === "cookie" ? cookie : null),
		},
	};
}

describe("/api/aws_download", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		parseCookie.mockReturnValue({ id: "user", hash: "secret" });
		login.mockResolvedValue({ id: "user", role: "student" });
		roleAuth.mockReturnValue(true);
		getS3.mockResolvedValue({});
		list.mockResolvedValue([
			{
				name: "2024-05-05 Test Session.png",
				type: "file",
				stat: { type: "file", size: 100 },
			},
		]);
		getSignedUrl.mockImplementation(async (_s3, command) => {
			return `https://signed.example/${command.Key}`;
		});
	});

	it("returns listing and presigned metadata URLs for authorized users", async () => {
		const response = await GET(
			request("http://localhost/api/aws_download?group=test&year=2024"),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(login).toHaveBeenCalledWith({
			id: "user",
			hash: "secret",
			api: "aws",
			path: "sessions/test/2024",
		});
		expect(list).toHaveBeenCalledWith({ path: "sessions/test/2024" });
		expect(body.items).toHaveLength(1);
		expect(body.urls.tags).toContain("sessions/test/2024.tags");
		expect(body.urls.duration).toContain("sessions/test/2024.duration");
		expect(body.urls.md).toContain("sessions/test/2024.md");
		expect(body.urls.zip).toContain("sessions/test/2024.zip");
	});

	it("rejects requests without credentials", async () => {
		parseCookie.mockReturnValue({});

		const response = await GET(
			request("http://localhost/api/aws_download?group=test&year=2024", ""),
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.err).toBe("ACCESS_DENIED");
		expect(list).not.toHaveBeenCalled();
	});

	it("rejects users without student access", async () => {
		roleAuth.mockReturnValue(false);

		const response = await GET(
			request("http://localhost/api/aws_download?group=test&year=2024"),
		);

		expect(response.status).toBe(403);
		expect(list).not.toHaveBeenCalled();
	});
});
