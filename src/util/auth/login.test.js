import { findRecord, insertRecord, replaceRecord } from "@util/storage/mongo";
import { compare, hash } from "bcryptjs";
import nodemailer from "nodemailer";
import {
	changePassword,
	login,
	register,
	resetPassword,
	sendResetEmail,
} from "./login";

jest.mock("@data/resetPasswordTemplate", () => "Hello {{name}}, {{resetlink}}");
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));
jest.mock("@util/storage/mongo", () => ({
	findRecord: jest.fn(),
	insertRecord: jest.fn(),
	replaceRecord: jest.fn(),
}));
jest.mock("bcryptjs", () => ({
	compare: jest.fn(),
	hash: jest.fn(),
}));
jest.mock("nodemailer", () => ({
	createTransport: jest.fn(() => ({
		sendMail: jest.fn().mockResolvedValue({}),
	})),
}));
jest.mock("uuid", () => ({ v4: jest.fn(() => "generated-token") }));

const transport = nodemailer.createTransport.mock.results[0].value;

describe("login", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws when the id is empty", async () => {
		await expect(login({ id: "", password: "x" })).rejects.toBe(
			"USER_NOT_FOUND",
		);
	});

	it("throws when finding the user fails", async () => {
		findRecord.mockRejectedValue(new Error("db down"));
		await expect(login({ id: "user", password: "x" })).rejects.toBe(
			"USER_NOT_FOUND",
		);
	});

	it("throws when the user does not exist", async () => {
		findRecord.mockResolvedValue(null);
		await expect(login({ id: "user", password: "x" })).rejects.toBe(
			"USER_NOT_FOUND",
		);
	});

	it("throws when no password is provided", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h" });
		await expect(login({ id: "user" })).rejects.toBe("PASSWORD_REQUIRED");
	});

	it("throws when the password does not match", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h" });
		compare.mockResolvedValue(false);
		await expect(login({ id: "user", password: "wrong" })).rejects.toBe(
			"WRONG_PASSWORD",
		);
	});

	it("logs in successfully and defaults the role to visitor", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h" });
		compare.mockResolvedValue(true);

		const user = await login({ id: "USER", password: "correct" });

		expect(user.role).toBe("visitor");
		expect(replaceRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				collectionName: "users",
				query: { id: "user" },
				record: expect.objectContaining({ role: "visitor" }),
			}),
		);
	});

	it("preserves an existing role", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h", role: "teacher" });
		compare.mockResolvedValue(true);

		const user = await login({ id: "user", password: "correct" });
		expect(user.role).toBe("teacher");
	});
});

describe("register", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws when the user already exists", async () => {
		findRecord.mockResolvedValue({ id: "user" });
		await expect(register({ id: "user", password: "pw" })).rejects.toBe(
			"USER_ALREADY_EXISTS",
		);
	});

	it("rethrows hashing errors", async () => {
		findRecord.mockResolvedValue(null);
		hash.mockRejectedValue(new Error("hash failed"));
		await expect(register({ id: "user", password: "pw" })).rejects.toThrow(
			"hash failed",
		);
	});

	it("creates a new user with the visitor role", async () => {
		findRecord.mockResolvedValue(null);
		hash.mockResolvedValue("hashed-pw");

		const result = await register({
			id: "NewUser",
			firstName: "New",
			lastName: "User",
			email: "new@example.com",
			password: "pw",
		});

		expect(result).toBe("hashed-pw");
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "users",
			record: expect.objectContaining({
				id: "newuser",
				role: "visitor",
				hash: "hashed-pw",
			}),
		});
	});
});

describe("changePassword", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("verifies the old password before setting the new one", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h" });
		compare.mockResolvedValue(true);
		hash.mockResolvedValue("new-hash");

		const result = await changePassword({
			id: "user",
			oldPassword: "old",
			newPassword: "new",
		});

		expect(result).toBe("new-hash");
		expect(replaceRecord).toHaveBeenLastCalledWith(
			expect.objectContaining({
				record: expect.objectContaining({ hash: "new-hash" }),
			}),
		);
	});

	it("rejects when the old password is wrong", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h" });
		compare.mockResolvedValue(false);
		await expect(
			changePassword({ id: "user", oldPassword: "wrong", newPassword: "new" }),
		).rejects.toBe("WRONG_PASSWORD");
	});
});

describe("resetPassword", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws when the user does not exist", async () => {
		findRecord.mockResolvedValue(null);
		await expect(
			resetPassword({ id: "user", code: "c", newPassword: "n" }),
		).rejects.toBe("USER_NOT_FOUND");
	});

	it("throws when there is no reset token on the user", async () => {
		findRecord.mockResolvedValue({ id: "user" });
		await expect(
			resetPassword({ id: "user", code: "c", newPassword: "n" }),
		).rejects.toBe("NO_RESET_TOKEN");
	});

	it("throws when the reset code does not match", async () => {
		findRecord.mockResolvedValue({
			id: "user",
			resetToken: "hashed-token",
			resetTokenExpiry: Date.now() + 100000,
		});
		compare.mockResolvedValue(false);
		await expect(
			resetPassword({ id: "user", code: "wrong", newPassword: "n" }),
		).rejects.toBe("INVALID_TOKEN");
	});

	it("throws when the reset token has expired", async () => {
		findRecord.mockResolvedValue({
			id: "user",
			resetToken: "hashed-token",
			resetTokenExpiry: Date.now() - 1000,
		});
		compare.mockResolvedValue(true);
		await expect(
			resetPassword({ id: "user", code: "c", newPassword: "n" }),
		).rejects.toBe("TOKEN_EXPIRED");
	});

	it("resets the password and clears the reset token fields", async () => {
		findRecord.mockResolvedValue({
			id: "user",
			resetToken: "hashed-token",
			resetTokenExpiry: Date.now() + 100000,
		});
		compare.mockResolvedValue(true);
		hash.mockResolvedValue("new-hash");

		const result = await resetPassword({
			id: "user",
			code: "c",
			newPassword: "n",
		});

		expect(result).toBe("new-hash");
		const [{ record }] = replaceRecord.mock.calls[0];
		expect(record.hash).toBe("new-hash");
		expect(record).not.toHaveProperty("resetToken");
		expect(record).not.toHaveProperty("resetTokenExpiry");
	});
});

describe("sendResetEmail", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws when the user cannot be found", async () => {
		findRecord.mockResolvedValue(null);
		await expect(sendResetEmail({ id: "user" })).rejects.toBe("USER_NOT_FOUND");
	});

	it("stores a hashed reset token and emails the reset link", async () => {
		findRecord.mockResolvedValue({
			id: "user",
			email: "user@example.com",
			firstName: "First",
			lastName: "Last",
		});
		hash.mockResolvedValue("hashed-token");

		await sendResetEmail({ id: "USER" });

		expect(replaceRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				record: expect.objectContaining({ resetToken: "hashed-token" }),
			}),
		);
		expect(transport.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				text: expect.stringContaining("First Last"),
			}),
		);
		expect(transport.sendMail.mock.calls[0][0].text).toContain(
			"generated-token",
		);
	});
});
