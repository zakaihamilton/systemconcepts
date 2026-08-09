import { roleAuth } from "@util/auth/roles";
import { getSessionUser } from "@util/auth/session";
import { findRecord, handleRequest } from "@util/storage/mongo";
import { hash as bcryptHash } from "bcryptjs";
import { DELETE, PUT } from "./route";

jest.mock("@util/auth/session", () => ({
	getSessionUser: jest.fn(),
	getAuthErrorStatus: jest.fn(() => 403),
	revokeAllSessions: jest.fn(),
}));
jest.mock("@util/auth/roles", () => ({ roleAuth: jest.fn() }));
jest.mock("@util/storage/mongo", () => ({
	findRecord: jest.fn(),
	handleRequest: jest.fn(),
}));
jest.mock("@util/api/safeError", () => ({
	getSafeError: jest.fn((err) => String(err?.message || err)),
}));
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));
jest.mock("@util/auth/requestSecurity", () => ({
	assertSameOrigin: jest.fn(),
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn() }));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			status: init.status || 200,
			json: async () => body,
		}),
	},
}));

function request({ method, id = "attacker", body }) {
	const headers = new Map([
		["id", id],
		["origin", "http://localhost"],
	]);
	return {
		method,
		url: "http://localhost/api/users",
		headers: {
			get: (name) => headers.get(name),
			entries: () => headers.entries(),
		},
		json: async () => body,
	};
}

describe("/api/users authorization and import handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "attacker", role: "student" });
		handleRequest.mockResolvedValue({});
	});

	it("does not allow a non-admin to delete another user's account", async () => {
		roleAuth.mockReturnValue(false);

		const response = await DELETE(
			request({ method: "DELETE", body: [{ id: "victim" }] }),
		);

		expect(response.status).toBe(403);
		expect(handleRequest).not.toHaveBeenCalled();
	});

	it("preserves existing auth fields during admin bulk import", async () => {
		roleAuth.mockReturnValue(true);
		findRecord.mockResolvedValue({
			id: "user",
			hash: "bcrypt-hash",
			salt: 10,
			credentials: [{ id: "credential" }],
			resetToken: "reset",
			resetTokenExpiry: 123,
			date: "date",
			utc: 123,
		});

		const records = [
			{ id: "user", email: "user@example.com", rssToken: "exported" },
		];
		await PUT(request({ method: "PUT", id: "", body: records }));

		expect(bcryptHash).not.toHaveBeenCalled();
		expect(records[0]).toEqual({
			id: "user",
			email: "user@example.com",
			hash: "bcrypt-hash",
			salt: 10,
			credentials: [{ id: "credential" }],
			resetToken: "reset",
			resetTokenExpiry: 123,
			date: "date",
			utc: 123,
		});
	});
});
