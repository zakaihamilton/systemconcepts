import { getSessionUser } from "@util/auth/session";
import { GET } from "./route";

jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err)),
}));
jest.mock("@util/auth/passkey", () => ({
	deletePasskey: jest.fn(),
	getPasskeyAuthOptions: jest.fn(),
	getPasskeyRegistrationOptions: jest.fn(),
	getPasskeys: jest.fn(),
	verifyPasskeyAuth: jest.fn(),
	verifyPasskeyRegistration: jest.fn(),
}));
jest.mock("@util/auth/rateLimit", () => ({
	checkRateLimit: jest.fn(),
}));
jest.mock("@util/auth/requestSecurity", () => ({
	assertSameOrigin: jest.fn(),
	getTrustedClientIp: jest.fn(() => "127.0.0.1"),
}));
jest.mock("@util/auth/session", () => ({
	createSession: jest.fn(),
	getAuthErrorStatus: jest.fn((err, fallback = 403) =>
		err === "AUTHENTICATION_REQUIRED" ? 401 : fallback,
	),
	getSessionUser: jest.fn(),
	setSessionCookies: jest.fn(),
}));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			status: init.status || 200,
			json: async () => body,
		}),
	},
}));

function request(url) {
	return {
		url,
		headers: { get: () => "localhost:3000" },
	};
}

describe("/api/passkey", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns 401 when a passkey-list request outlives its session", async () => {
		getSessionUser.mockRejectedValue("AUTHENTICATION_REQUIRED");

		const response = await GET(
			request("http://localhost:3000/api/passkey?action=list&id=user"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			err: "AUTHENTICATION_REQUIRED",
		});
	});
});
