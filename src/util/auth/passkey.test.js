import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
	deleteRecord,
	findRecord,
	insertRecord,
	replaceRecord,
} from "@util/storage/mongo";
import { hash } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import {
	deletePasskey,
	getPasskeyAuthOptions,
	getPasskeyRegistrationOptions,
	getPasskeys,
	verifyPasskeyAuth,
	verifyPasskeyRegistration,
} from "./passkey";

jest.mock("@simplewebauthn/server", () => ({
	generateAuthenticationOptions: jest.fn(),
	generateRegistrationOptions: jest.fn(),
	verifyAuthenticationResponse: jest.fn(),
	verifyRegistrationResponse: jest.fn(),
}));
jest.mock("@util/storage/mongo", () => ({
	deleteRecord: jest.fn(),
	findRecord: jest.fn(),
	insertRecord: jest.fn(),
	replaceRecord: jest.fn(),
}));
jest.mock("bcryptjs", () => ({
	hash: jest.fn(),
}));
jest.mock("uuid", () => ({
	v4: jest.fn(),
}));

const rpID = "example.com";
const origin = "https://example.com";

describe("getPasskeyRegistrationOptions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		generateRegistrationOptions.mockResolvedValue({
			challenge: "reg-challenge",
			rp: { id: rpID, name: "App" },
		});
	});

	it("throws MISSING_ID when id is absent", async () => {
		await expect(
			getPasskeyRegistrationOptions({ email: "a@b.com", rpID }),
		).rejects.toBe("MISSING_ID");
	});

	it("throws USER_ALREADY_EXISTS when the user exists and is not authenticated", async () => {
		findRecord.mockResolvedValue({ id: "alice", credentials: [] });

		await expect(
			getPasskeyRegistrationOptions({
				id: "Alice",
				email: "a@b.com",
				rpID,
				authenticated: false,
			}),
		).rejects.toBe("USER_ALREADY_EXISTS");
	});

	it("returns options and stores a challenge for a new user", async () => {
		findRecord.mockResolvedValue(null);

		const options = await getPasskeyRegistrationOptions({
			id: "Alice",
			email: "a@b.com",
			firstName: "Alice",
			lastName: "Smith",
			rpID,
		});

		expect(options.challenge).toBe("reg-challenge");
		expect(deleteRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			query: { userId: "alice", type: "register" },
		});
		expect(generateRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				rpID,
				userName: "a@b.com",
				excludeCredentials: [],
			}),
		);
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			record: expect.objectContaining({
				userId: "alice",
				challenge: "reg-challenge",
				type: "register",
				userInfo: {
					email: "a@b.com",
					firstName: "Alice",
					lastName: "Smith",
				},
			}),
		});
	});

	it("allows an authenticated user to register another passkey", async () => {
		findRecord.mockResolvedValue({
			id: "alice",
			email: "stored@b.com",
			credentials: [{ id: "cred-1", transports: ["internal"] }],
		});

		await getPasskeyRegistrationOptions({
			id: "alice",
			rpID,
			authenticated: true,
		});

		expect(generateRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				userName: "stored@b.com",
				excludeCredentials: [{ id: "cred-1", transports: ["internal"] }],
			}),
		);
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			record: expect.objectContaining({
				userId: "alice",
				userInfo: null,
			}),
		});
	});
	it("defaults userName to the id when email is absent", async () => {
		findRecord.mockResolvedValue(null);

		await getPasskeyRegistrationOptions({ id: "alice", rpID });

		expect(generateRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({ userName: "alice" }),
		);
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			record: expect.objectContaining({
				userInfo: { email: null, firstName: null, lastName: null },
			}),
		});
	});
});

describe("verifyPasskeyRegistration", () => {
	const response = { id: "attestation" };

	beforeEach(() => {
		jest.clearAllMocks();
		uuidv4.mockReturnValue("random-password");
		hash.mockResolvedValue("hashed-password");
	});

	it("throws MISSING_ID when id is absent", async () => {
		await expect(
			verifyPasskeyRegistration({ response, origin, rpID }),
		).rejects.toBe("MISSING_ID");
	});

	it("throws CHALLENGE_NOT_FOUND when no challenge exists", async () => {
		findRecord.mockResolvedValueOnce(null);

		await expect(
			verifyPasskeyRegistration({
				id: "alice",
				response,
				origin,
				rpID,
			}),
		).rejects.toBe("CHALLENGE_NOT_FOUND");
	});

	it("throws CHALLENGE_EXPIRED when the challenge is older than the TTL", async () => {
		findRecord.mockResolvedValueOnce({
			challenge: "old",
			createdAt: new Date(Date.now() - 16 * 60 * 1000),
			type: "register",
		});

		await expect(
			verifyPasskeyRegistration({
				id: "alice",
				response,
				origin,
				rpID,
			}),
		).rejects.toBe("CHALLENGE_EXPIRED");
	});

	it("throws VERIFICATION_FAILED when the attestation is not verified", async () => {
		findRecord.mockResolvedValueOnce({
			challenge: "reg-challenge",
			createdAt: new Date(),
			type: "register",
		});
		verifyRegistrationResponse.mockResolvedValue({ verified: false });

		await expect(
			verifyPasskeyRegistration({
				id: "alice",
				response,
				origin,
				rpID,
			}),
		).rejects.toBe("VERIFICATION_FAILED");
	});

	it("throws USER_ALREADY_EXISTS when verifying for an existing unauthenticated user", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "reg-challenge",
				createdAt: new Date(),
				type: "register",
				userInfo: {},
			})
			.mockResolvedValueOnce({ id: "alice", credentials: [] });
		verifyRegistrationResponse.mockResolvedValue({
			verified: true,
			registrationInfo: {
				credential: {
					id: "cred-new",
					publicKey: new Uint8Array([1, 2, 3]),
					counter: 0,
					transports: ["usb"],
				},
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
			},
		});

		await expect(
			verifyPasskeyRegistration({
				id: "alice",
				response,
				origin,
				rpID,
				authenticated: false,
			}),
		).rejects.toBe("USER_ALREADY_EXISTS");
	});

	it("creates a new user on successful registration", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "reg-challenge",
				createdAt: new Date(),
				type: "register",
				userInfo: {
					email: "a@b.com",
					firstName: "Alice",
					lastName: "Smith",
				},
			})
			.mockResolvedValueOnce(null);
		verifyRegistrationResponse.mockResolvedValue({
			verified: true,
			registrationInfo: {
				credential: {
					id: "cred-new",
					publicKey: new Uint8Array([1, 2, 3]),
					counter: 0,
					transports: ["usb"],
				},
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
			},
		});

		const result = await verifyPasskeyRegistration({
			id: "Alice",
			response,
			name: "Laptop",
			origin,
			rpID,
		});

		expect(result.verified).toBe(true);
		expect(result.user).toEqual(
			expect.objectContaining({
				id: "alice",
				email: "a@b.com",
				firstName: "Alice",
				lastName: "Smith",
				role: "visitor",
				hash: "hashed-password",
				credentials: [
					expect.objectContaining({
						id: "cred-new",
						name: "Laptop",
						publicKey: Buffer.from([1, 2, 3]).toString("base64"),
					}),
				],
			}),
		);
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "users",
			record: result.user,
		});
		expect(deleteRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			query: { userId: "alice", type: "register" },
		});
	});

	it("defaults user fields and passkey name when userInfo and name are absent", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "reg-challenge",
				createdAt: new Date(),
				type: "register",
			})
			.mockResolvedValueOnce(null);
		verifyRegistrationResponse.mockResolvedValue({
			verified: true,
			registrationInfo: {
				credential: {
					id: "cred-new",
					publicKey: new Uint8Array([1]),
					counter: 0,
				},
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
			},
		});

		const result = await verifyPasskeyRegistration({
			id: "alice",
			response,
			origin,
			rpID,
		});

		expect(result.user.email).toBe("alice");
		expect(result.user.firstName).toBeNull();
		expect(result.user.lastName).toBeNull();
		expect(result.user.credentials[0].name).toBe("Passkey 1");
	});

	it("adds a credential to an authenticated existing user", async () => {
		const existingUser = {
			id: "alice",
			email: "a@b.com",
			credentials: [{ id: "cred-1", name: "Passkey 1" }],
		};
		findRecord
			.mockResolvedValueOnce({
				challenge: "reg-challenge",
				createdAt: new Date(),
				type: "register",
				userInfo: null,
			})
			.mockResolvedValueOnce(existingUser);
		verifyRegistrationResponse.mockResolvedValue({
			verified: true,
			registrationInfo: {
				credential: {
					id: "cred-2",
					publicKey: new Uint8Array([9, 8]),
					counter: 1,
					transports: ["internal"],
				},
				credentialDeviceType: "multiDevice",
				credentialBackedUp: true,
			},
		});

		const result = await verifyPasskeyRegistration({
			id: "alice",
			response,
			origin,
			rpID,
			authenticated: true,
		});

		expect(result.verified).toBe(true);
		expect(replaceRecord).toHaveBeenCalledWith({
			collectionName: "users",
			query: { id: "alice" },
			record: expect.objectContaining({
				credentials: expect.arrayContaining([
					expect.objectContaining({ id: "cred-1" }),
					expect.objectContaining({
						id: "cred-2",
						name: "Passkey 2",
					}),
				]),
			}),
		});
	});

	it("defaults credentials to an empty array when the authenticated user has none", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "reg-challenge",
				createdAt: new Date(),
				type: "register",
			})
			.mockResolvedValueOnce({ id: "alice" });
		verifyRegistrationResponse.mockResolvedValue({
			verified: true,
			registrationInfo: {
				credential: {
					id: "cred-1",
					publicKey: new Uint8Array([1]),
					counter: 0,
				},
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
			},
		});

		await verifyPasskeyRegistration({
			id: "alice",
			response,
			origin,
			rpID,
			authenticated: true,
		});

		expect(replaceRecord).toHaveBeenCalledWith({
			collectionName: "users",
			query: { id: "alice" },
			record: expect.objectContaining({
				credentials: [expect.objectContaining({ name: "Passkey 1" })],
			}),
		});
	});
});

describe("getPasskeys", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws MISSING_ID when id is absent", async () => {
		await expect(getPasskeys({})).rejects.toBe("MISSING_ID");
	});

	it("throws USER_NOT_FOUND when the user does not exist", async () => {
		findRecord.mockResolvedValue(null);
		await expect(getPasskeys({ id: "alice" })).rejects.toBe("USER_NOT_FOUND");
	});

	it("returns mapped credentials", async () => {
		findRecord.mockResolvedValue({
			id: "alice",
			credentials: [
				{ id: "c1", name: "Phone", createdAt: "2024-01-01" },
				{ id: "c2", createdAt: "2024-02-01" },
			],
		});

		await expect(getPasskeys({ id: "Alice" })).resolves.toEqual([
			{ id: "c1", name: "Phone", createdAt: "2024-01-01" },
			{ id: "c2", name: "Passkey", createdAt: "2024-02-01" },
		]);
	});

	it("returns an empty list when the user has no credentials field", async () => {
		findRecord.mockResolvedValue({ id: "alice" });
		await expect(getPasskeys({ id: "alice" })).resolves.toEqual([]);
	});
});

describe("deletePasskey", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws MISSING_ID when id is absent", async () => {
		await expect(deletePasskey({ credentialId: "c1" })).rejects.toBe(
			"MISSING_ID",
		);
	});

	it("throws USER_NOT_FOUND when the user does not exist", async () => {
		findRecord.mockResolvedValue(null);
		await expect(
			deletePasskey({ id: "alice", credentialId: "c1" }),
		).rejects.toBe("USER_NOT_FOUND");
	});

	it("removes the matching credential", async () => {
		findRecord.mockResolvedValue({
			id: "alice",
			credentials: [{ id: "c1" }, { id: "c2" }],
		});

		await expect(
			deletePasskey({ id: "Alice", credentialId: "c1" }),
		).resolves.toEqual({ success: true });

		expect(replaceRecord).toHaveBeenCalledWith({
			collectionName: "users",
			query: { id: "alice" },
			record: expect.objectContaining({
				credentials: [{ id: "c2" }],
			}),
		});
	});

	it("treats a missing credentials field as an empty list", async () => {
		findRecord.mockResolvedValue({ id: "alice" });

		await deletePasskey({ id: "alice", credentialId: "missing" });

		expect(replaceRecord).toHaveBeenCalledWith({
			collectionName: "users",
			query: { id: "alice" },
			record: expect.objectContaining({ credentials: [] }),
		});
	});
});

describe("getPasskeyAuthOptions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		generateAuthenticationOptions.mockResolvedValue({
			challenge: "auth-challenge",
		});
	});

	it("throws USER_NOT_FOUND when an id is provided but the user is missing", async () => {
		findRecord.mockResolvedValue(null);

		await expect(getPasskeyAuthOptions({ id: "alice", rpID })).rejects.toBe(
			"USER_NOT_FOUND",
		);
	});

	it("returns options for a known user and stores an auth challenge", async () => {
		findRecord.mockResolvedValue({
			id: "alice",
			credentials: [{ id: "cred-1", transports: ["internal"] }],
		});

		const options = await getPasskeyAuthOptions({ id: "Alice", rpID });

		expect(options.challenge).toBe("auth-challenge");
		expect(deleteRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			query: { userId: "alice", type: "auth" },
		});
		expect(generateAuthenticationOptions).toHaveBeenCalledWith({
			rpID,
			allowCredentials: [{ id: "cred-1", transports: ["internal"] }],
			userVerification: "preferred",
		});
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			record: expect.objectContaining({
				userId: "alice",
				challenge: "auth-challenge",
				type: "auth",
			}),
		});
	});

	it("uses an empty allowCredentials list when the user has no credentials", async () => {
		findRecord.mockResolvedValue({ id: "alice" });

		await getPasskeyAuthOptions({ id: "alice", rpID });

		expect(generateAuthenticationOptions).toHaveBeenCalledWith(
			expect.objectContaining({ allowCredentials: [] }),
		);
	});

	it("supports discoverable credentials when no id is provided", async () => {
		const options = await getPasskeyAuthOptions({ rpID });

		expect(options.challenge).toBe("auth-challenge");
		expect(findRecord).not.toHaveBeenCalled();
		expect(deleteRecord).not.toHaveBeenCalled();
		expect(generateAuthenticationOptions).toHaveBeenCalledWith({
			rpID,
			allowCredentials: [],
			userVerification: "preferred",
		});
		expect(insertRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			record: expect.objectContaining({
				userId: undefined,
				type: "auth",
			}),
		});
	});
});

describe("verifyPasskeyAuth", () => {
	const response = { id: "cred-1" };
	const credential = {
		id: "cred-1",
		publicKey: Buffer.from([1, 2, 3]).toString("base64"),
		counter: 0,
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws MISSING_ID when id is absent", async () => {
		await expect(verifyPasskeyAuth({ response, origin, rpID })).rejects.toBe(
			"MISSING_ID",
		);
	});

	it("throws CHALLENGE_NOT_FOUND when no auth challenge exists", async () => {
		findRecord.mockResolvedValueOnce(null);

		await expect(
			verifyPasskeyAuth({ id: "alice", response, origin, rpID }),
		).rejects.toBe("CHALLENGE_NOT_FOUND");
	});

	it("throws CHALLENGE_EXPIRED for a stale auth challenge", async () => {
		findRecord.mockResolvedValueOnce({
			challenge: "auth-challenge",
			createdAt: new Date(Date.now() - 20 * 60 * 1000),
			type: "auth",
		});

		await expect(
			verifyPasskeyAuth({ id: "alice", response, origin, rpID }),
		).rejects.toBe("CHALLENGE_EXPIRED");
	});

	it("throws USER_NOT_FOUND when the user is missing", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "auth-challenge",
				createdAt: new Date(),
				type: "auth",
			})
			.mockResolvedValueOnce(null);

		await expect(
			verifyPasskeyAuth({ id: "alice", response, origin, rpID }),
		).rejects.toBe("USER_NOT_FOUND");
	});

	it("throws CREDENTIAL_NOT_FOUND when the assertion id is unknown", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "auth-challenge",
				createdAt: new Date(),
				type: "auth",
			})
			.mockResolvedValueOnce({ id: "alice", credentials: [credential] });

		await expect(
			verifyPasskeyAuth({
				id: "alice",
				response: { id: "unknown" },
				origin,
				rpID,
			}),
		).rejects.toBe("CREDENTIAL_NOT_FOUND");
	});

	it("throws VERIFICATION_FAILED when the assertion is not verified", async () => {
		findRecord
			.mockResolvedValueOnce({
				challenge: "auth-challenge",
				createdAt: new Date(),
				type: "auth",
			})
			.mockResolvedValueOnce({ id: "alice", credentials: [credential] });
		verifyAuthenticationResponse.mockResolvedValue({ verified: false });

		await expect(
			verifyPasskeyAuth({ id: "alice", response, origin, rpID }),
		).rejects.toBe("VERIFICATION_FAILED");
	});

	it("updates the counter and returns the user on success", async () => {
		const user = { id: "alice", credentials: [credential], role: "teacher" };
		findRecord
			.mockResolvedValueOnce({
				challenge: "auth-challenge",
				createdAt: new Date(),
				type: "auth",
			})
			.mockResolvedValueOnce(user);
		verifyAuthenticationResponse.mockResolvedValue({
			verified: true,
			authenticationInfo: { newCounter: 5 },
		});

		const result = await verifyPasskeyAuth({
			id: "Alice",
			response,
			origin,
			rpID,
		});

		expect(result).toBe(user);
		expect(credential.counter).toBe(5);
		expect(replaceRecord).toHaveBeenCalled();
		expect(deleteRecord).toHaveBeenCalledWith({
			collectionName: "challenges",
			query: { userId: "alice", type: "auth" },
		});
		expect(verifyAuthenticationResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				response,
				expectedChallenge: "auth-challenge",
				expectedOrigin: origin,
				expectedRPID: rpID,
				authenticator: expect.objectContaining({
					credentialID: "cred-1",
					counter: 0,
				}),
			}),
		);
	});
});
