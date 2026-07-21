import { deleteRecord, findRecord, insertRecord } from "@util/storage/mongo";
import crypto from "crypto";
import {
	AUTHENTICATION_REQUIRED,
	clearSessionCookies,
	createSession,
	getAuthErrorStatus,
	getSessionUser,
	revokeSession,
	SESSION_COOKIE,
	SESSION_MARKER_COOKIE,
	setSessionCookies,
} from "./session";

jest.mock("@util/storage/mongo", () => ({
	deleteRecord: jest.fn(),
	findRecord: jest.fn(),
	insertRecord: jest.fn(),
}));

function digest(token) {
	return crypto.createHash("sha256").update(token).digest("hex");
}

function requestWithCookie(name, value) {
	return {
		cookies: {
			get: (cookieName) => (cookieName === name ? { value } : undefined),
		},
	};
}

describe("createSession", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("stores a hashed session record and returns the raw token", async () => {
		const session = await createSession("User@Example.com");

		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "auth_sessions",
			record: expect.objectContaining({
				id: digest(session.token),
				userId: "user@example.com",
			}),
		});
		expect(session.remember).toBe(true);
		expect(session.expiresAt).toBeInstanceOf(Date);
	});

	it("passes through the remember flag", async () => {
		const session = await createSession("user", false);
		expect(session.remember).toBe(false);
	});
});

describe("getSessionUser", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws when there is no session cookie", async () => {
		await expect(
			getSessionUser({ cookies: { get: () => undefined } }),
		).rejects.toBe(AUTHENTICATION_REQUIRED);
	});

	it("throws when the session cannot be found", async () => {
		findRecord.mockResolvedValueOnce(null);
		await expect(
			getSessionUser(requestWithCookie(SESSION_COOKIE, "token")),
		).rejects.toBe(AUTHENTICATION_REQUIRED);
	});

	it("throws when the session has expired", async () => {
		findRecord.mockResolvedValueOnce({
			userId: "user",
			expiresAt: new Date(Date.now() - 1000),
		});
		await expect(
			getSessionUser(requestWithCookie(SESSION_COOKIE, "token")),
		).rejects.toBe(AUTHENTICATION_REQUIRED);
	});

	it("throws when the session is valid but the user no longer exists", async () => {
		findRecord
			.mockResolvedValueOnce({
				userId: "user",
				expiresAt: new Date(Date.now() + 100000),
			})
			.mockResolvedValueOnce(null);
		await expect(
			getSessionUser(requestWithCookie(SESSION_COOKIE, "token")),
		).rejects.toBe(AUTHENTICATION_REQUIRED);
	});

	it("returns the user for a valid session", async () => {
		const user = { id: "user", role: "student" };
		findRecord
			.mockResolvedValueOnce({
				userId: "user",
				expiresAt: new Date(Date.now() + 100000),
			})
			.mockResolvedValueOnce(user);
		await expect(
			getSessionUser(requestWithCookie(SESSION_COOKIE, "token")),
		).resolves.toEqual(user);
	});
});

describe("getAuthErrorStatus", () => {
	it("maps AUTHENTICATION_REQUIRED to 401", () => {
		expect(getAuthErrorStatus(AUTHENTICATION_REQUIRED)).toBe(401);
	});

	it("returns the fallback status for other errors", () => {
		expect(getAuthErrorStatus("SOME_ERROR")).toBe(403);
		expect(getAuthErrorStatus("SOME_ERROR", 400)).toBe(400);
	});
});

describe("revokeSession", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("does nothing without a session cookie", async () => {
		await revokeSession({ cookies: { get: () => undefined } });
		expect(deleteRecord).not.toHaveBeenCalled();
	});

	it("deletes the session record matching the token digest", async () => {
		await revokeSession(requestWithCookie(SESSION_COOKIE, "token"));
		expect(deleteRecord).toHaveBeenCalledWith({
			collectionName: "auth_sessions",
			query: { id: digest("token") },
		});
	});
});

describe("setSessionCookies / clearSessionCookies", () => {
	function fakeResponse() {
		return { cookies: { set: jest.fn() } };
	}

	it("sets the session, id, and marker cookies with the remember expiry", () => {
		const response = fakeResponse();
		const expiresAt = new Date(Date.now() + 1000);
		setSessionCookies(
			response,
			{ token: "token", expiresAt, remember: true },
			{ id: "user" },
		);

		expect(response.cookies.set).toHaveBeenCalledWith(
			SESSION_COOKIE,
			"token",
			expect.objectContaining({ httpOnly: true, expires: expiresAt }),
		);
		expect(response.cookies.set).toHaveBeenCalledWith(
			"id",
			"user",
			expect.objectContaining({ expires: expiresAt }),
		);
		expect(response.cookies.set).toHaveBeenCalledWith(
			SESSION_MARKER_COOKIE,
			"signed-in",
			expect.objectContaining({ expires: expiresAt }),
		);
	});

	it("omits the expiry when the session should not be remembered", () => {
		const response = fakeResponse();
		setSessionCookies(
			response,
			{ token: "token", expiresAt: new Date(), remember: false },
			{ id: "user" },
		);

		for (const call of response.cookies.set.mock.calls) {
			expect(call[2]).not.toHaveProperty("expires");
		}
	});

	it("clears all auth cookies with maxAge 0", () => {
		const response = fakeResponse();
		clearSessionCookies(response);

		expect(response.cookies.set).toHaveBeenCalledTimes(4);
		for (const call of response.cookies.set.mock.calls) {
			expect(call[2].maxAge).toBe(0);
		}
		expect(response.cookies.set).toHaveBeenCalledWith(
			SESSION_COOKIE,
			"",
			expect.objectContaining({ httpOnly: true }),
		);
		expect(response.cookies.set).toHaveBeenCalledWith(
			"role",
			"",
			expect.objectContaining({ httpOnly: false }),
		);
	});
});
