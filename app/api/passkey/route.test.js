import {
	deletePasskey,
	getPasskeyAuthOptions,
	getPasskeyRegistrationOptions,
	getPasskeys,
	verifyPasskeyAuth,
	verifyPasskeyRegistration,
} from "@util/auth/passkey";
import { assertSameOrigin } from "@util/auth/requestSecurity";
import {
	createSession,
	getSessionUser,
	setSessionCookies,
} from "@util/auth/session";
import { DELETE, GET, POST } from "./route";

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
	checkRateLimit: jest.fn().mockResolvedValue(undefined),
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
			cookies: { set: jest.fn() },
		}),
	},
}));

function request(url, { method = "GET", body } = {}) {
	return {
		url,
		method,
		headers: {
			get: (name) => {
				if (name === "x-forwarded-host" || name === "host") {
					return "localhost:3000";
				}
				return null;
			},
		},
		json: async () => body ?? {},
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

	it("returns registration options", async () => {
		getSessionUser.mockRejectedValue("AUTHENTICATION_REQUIRED");
		getPasskeyRegistrationOptions.mockResolvedValue({ challenge: "c1" });

		const response = await GET(
			request(
				"http://localhost:3000/api/passkey?action=register-options&id=user&email=a@b.com",
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ challenge: "c1" });
		expect(getPasskeyRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "user",
				email: "a@b.com",
				rpID: "localhost",
				authenticated: false,
			}),
		);
	});

	it("returns auth options", async () => {
		getPasskeyAuthOptions.mockResolvedValue({ challenge: "auth" });

		const response = await GET(
			request("http://localhost:3000/api/passkey?action=auth-options&id=user"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ challenge: "auth" });
	});

	it("lists passkeys for the authenticated owner", async () => {
		getSessionUser.mockResolvedValue({ id: "user" });
		getPasskeys.mockResolvedValue([{ id: "c1", name: "Phone" }]);

		const response = await GET(
			request("http://localhost:3000/api/passkey?action=list&id=user"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([{ id: "c1", name: "Phone" }]);
	});

	it("rejects listing passkeys for another user", async () => {
		getSessionUser.mockResolvedValue({ id: "other" });

		const response = await GET(
			request("http://localhost:3000/api/passkey?action=list&id=user"),
		);

		expect(response.status).toBe(401);
	});

	it("rejects an invalid GET action", async () => {
		const response = await GET(
			request("http://localhost:3000/api/passkey?action=nope"),
		);
		expect(response.status).toBe(400);
	});

	it("deletes a passkey for the authenticated owner", async () => {
		getSessionUser.mockResolvedValue({ id: "user" });
		deletePasskey.mockResolvedValue({ success: true });

		const response = await DELETE(
			request("http://localhost:3000/api/passkey?id=user&credentialId=c1", {
				method: "DELETE",
			}),
		);

		expect(assertSameOrigin).toHaveBeenCalled();
		expect(deletePasskey).toHaveBeenCalledWith({
			id: "user",
			credentialId: "c1",
		});
		expect(response.status).toBe(200);
	});

	it("verifies registration", async () => {
		getSessionUser.mockRejectedValue("AUTHENTICATION_REQUIRED");
		verifyPasskeyRegistration.mockResolvedValue({ verified: true });

		const response = await POST(
			request(
				"http://localhost:3000/api/passkey?action=register-verify&id=user",
				{
					method: "POST",
					body: { id: "attestation", name: "Laptop" },
				},
			),
		);

		expect(response.status).toBe(200);
		expect(verifyPasskeyRegistration).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "user",
				name: "Laptop",
				response: { id: "attestation" },
				rpID: "localhost",
				authenticated: false,
			}),
		);
	});

	it("verifies auth and sets session cookies", async () => {
		verifyPasskeyAuth.mockResolvedValue({ id: "user", role: "teacher" });
		createSession.mockResolvedValue({ token: "sess" });

		const response = await POST(
			request("http://localhost:3000/api/passkey?action=auth-verify&id=user", {
				method: "POST",
				body: { id: "cred-1" },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ role: "teacher" });
		expect(createSession).toHaveBeenCalledWith("user");
		expect(setSessionCookies).toHaveBeenCalled();
	});

	it("rejects an invalid POST action", async () => {
		const response = await POST(
			request("http://localhost:3000/api/passkey?action=nope", {
				method: "POST",
				body: {},
			}),
		);
		expect(response.status).toBe(400);
	});

	it("marks registration options as authenticated when the session matches", async () => {
		getSessionUser.mockResolvedValue({ id: "user" });
		getPasskeyRegistrationOptions.mockResolvedValue({ challenge: "c2" });

		await GET(
			request(
				"http://localhost:3000/api/passkey?action=register-options&id=user&email=a@b.com",
			),
		);

		expect(getPasskeyRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({ authenticated: true }),
		);
	});

	it("rejects deleting a passkey for another user", async () => {
		getSessionUser.mockResolvedValue({ id: "other" });

		const response = await DELETE(
			request("http://localhost:3000/api/passkey?id=user&credentialId=c1", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(401);
		expect(deletePasskey).not.toHaveBeenCalled();
	});

	it("returns a safe error when rate limiting fails", async () => {
		const { checkRateLimit } = require("@util/auth/rateLimit");
		checkRateLimit.mockRejectedValueOnce("RATE_LIMIT_EXCEEDED");

		const response = await GET(
			request("http://localhost:3000/api/passkey?action=auth-options&id=user"),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ err: "RATE_LIMIT_EXCEEDED" });
	});

	it("defaults visitor role when auth verification omits a role", async () => {
		verifyPasskeyAuth.mockResolvedValue({ id: "user" });
		createSession.mockResolvedValue({ token: "sess" });

		const response = await POST(
			request("http://localhost:3000/api/passkey?action=auth-verify&id=user", {
				method: "POST",
				body: { id: "cred-1" },
			}),
		);

		expect(await response.json()).toEqual({ role: "visitor" });
	});

	it("returns 500 for unexpected POST failures", async () => {
		verifyPasskeyAuth.mockRejectedValue(new Error("verification failed"));

		const response = await POST(
			request("http://localhost:3000/api/passkey?action=auth-verify&id=user", {
				method: "POST",
				body: { id: "cred-1" },
			}),
		);

		expect(response.status).toBe(500);
	});
});
