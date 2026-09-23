import { getTrustedClientIp } from "@util/auth/requestSecurity";
import { getCollection } from "@util/storage/mongo";
import { checkRateLimit } from "./rateLimit";

jest.mock("@util/auth/requestSecurity", () => ({
	getTrustedClientIp: jest.fn(() => "203.0.113.1"),
}));
jest.mock("@util/storage/mongo", () => ({
	getCollection: jest.fn(),
}));

describe("checkRateLimit", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("uses the trusted client ip as the identifier by default", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue({ count: 1 });
		getCollection.mockResolvedValue({ findOneAndUpdate });

		await checkRateLimit({});

		expect(getTrustedClientIp).toHaveBeenCalledWith({});
		expect(findOneAndUpdate).toHaveBeenCalledWith(
			{ ip: "203.0.113.1" },
			expect.anything(),
			{ returnDocument: "after" },
		);
	});

	it("uses the explicit key instead of the ip when provided", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue({ count: 1 });
		getCollection.mockResolvedValue({ findOneAndUpdate });

		await checkRateLimit({}, { key: "user-a" });

		expect(findOneAndUpdate).toHaveBeenCalledWith(
			{ ip: "user-a" },
			expect.anything(),
			expect.anything(),
		);
		expect(getTrustedClientIp).not.toHaveBeenCalled();
	});

	it("resolves without throwing when the count is within the limit", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue({ count: 5 });
		getCollection.mockResolvedValue({ findOneAndUpdate });

		await expect(checkRateLimit({}, { limit: 5 })).resolves.toBeUndefined();
	});

	it("throws RATE_LIMIT_EXCEEDED when the count exceeds the limit", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue({ count: 6 });
		getCollection.mockResolvedValue({ findOneAndUpdate });

		await expect(checkRateLimit({}, { limit: 5 })).rejects.toBe(
			"RATE_LIMIT_EXCEEDED",
		);
	});

	it("inserts a fresh record when none exists yet", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue(null);
		const insertOne = jest.fn().mockResolvedValue({});
		getCollection.mockResolvedValue({ findOneAndUpdate, insertOne });

		await checkRateLimit({}, { limit: 5, windowMs: 1000 });

		expect(insertOne).toHaveBeenCalledWith(
			expect.objectContaining({ ip: "203.0.113.1", count: 1 }),
		);
	});

	it("retries via a recursive call when insertOne hits a duplicate key", async () => {
		const findOneAndUpdate = jest
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ count: 1 });
		const duplicateKeyError = Object.assign(new Error("dup"), { code: 11000 });
		const insertOne = jest.fn().mockRejectedValue(duplicateKeyError);
		getCollection.mockResolvedValue({ findOneAndUpdate, insertOne });

		await expect(checkRateLimit({}, { limit: 5 })).resolves.toBeUndefined();
		expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
	});

	it("rethrows unexpected errors from insertOne", async () => {
		const findOneAndUpdate = jest.fn().mockResolvedValue(null);
		const insertOne = jest.fn().mockRejectedValue(new Error("db down"));
		getCollection.mockResolvedValue({ findOneAndUpdate, insertOne });

		await expect(checkRateLimit({}, {})).rejects.toThrow("db down");
	});
});
