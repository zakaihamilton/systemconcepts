import { roleAuth } from "@util/auth/roles";
import {
	getAuthErrorStatus,
	getSessionUser,
	revokeAllSessions,
} from "@util/auth/session";
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
		json: (body: any, init: ResponseInit = {}) => ({
			status: init.status || 200,
			json: async () => body,
		}),
	},
}));

function request({ method, id = "attacker", body }: any) {
	const headers = new Map([
		["id", id],
		["origin", "http://localhost"],
	]);
	return {
		method,
		url: "http://localhost/api/users",
		headers: {
			get: (name: any) => headers.get(name),
			entries: () => headers.entries(),
		},
		json: async () => body,
	};
}

describe("/api/users authorization and import handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		asMock(getSessionUser).mockResolvedValue({
			id: "attacker",
			role: "student",
		});
		asMock(handleRequest).mockResolvedValue({});
	});

	it("does not allow a non-admin to delete another user's account", async () => {
		asMock(roleAuth).mockReturnValue(false);

		const response = await DELETE(
			request({ method: "DELETE", body: [{ id: "victim" }] }),
		);

		expect(response.status).toBe(403);
		expect(handleRequest).not.toHaveBeenCalled();
	});

	it("preserves existing auth fields during admin bulk import", async () => {
		asMock(roleAuth).mockReturnValue(true);
		asMock(findRecord).mockResolvedValue({
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

	it("rejects a user update that attempts to change their role", async () => {
		asMock(getAuthErrorStatus).mockReturnValue(403);
		asMock(getSessionUser).mockResolvedValue({
			id: "attacker",
			role: "student",
		});
		asMock(roleAuth).mockReturnValue(false);
		asMock(findRecord).mockResolvedValue({
			id: "attacker",
			hash: "old-hash",
			salt: 10,
			role: "student",
		});

		const body = { id: "attacker", role: "admin" };
		const response = await PUT(request({ method: "PUT", body }));

		expect(response.status).toBe(403);
		expect(handleRequest).not.toHaveBeenCalled();
	});

	it("hashes passwords and revokes sessions during nested admin imports", async () => {
		asMock(roleAuth).mockReturnValue(true);
		asMock(findRecord).mockResolvedValue({
			id: "user",
			hash: "old-hash",
			salt: 10,
			credentials: [],
			date: "date",
			utc: 123,
		});
		asMock(bcryptHash).mockResolvedValue("new-hash");

		const body = {
			users: [null, { id: "user", password: "new-password", rssToken: "old" }],
		};
		await PUT(request({ method: "PUT", id: "", body }));

		expect(bcryptHash).toHaveBeenCalledWith("new-password", 10);
		expect(revokeAllSessions).toHaveBeenCalledWith("user");
		expect(body.users[1]).toMatchObject({ id: "user", hash: "new-hash" });
		expect(body.users[1].password).toBeUndefined();
		expect(body.users[1].rssToken).toBeUndefined();
	});
});
