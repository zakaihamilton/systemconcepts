import storage from "@storage/aws";
import { requireRelogin } from "@util/api/fetch";

jest.mock("@util/data/binary", () => ({
	binaryToString: jest.fn(),
}));
jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
	requireRelogin: jest.fn(),
}));

describe("AWS storage authentication", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("requires re-login when a direct file read receives 401", async () => {
		const response = {
			status: 401,
			ok: false,
			headers: { get: jest.fn(() => "application/json") },
		};
		global.fetch.mockResolvedValue(response);
		requireRelogin.mockReturnValue(true);

		await expect(
			storage.readFile("aws/personal/user/manifest.json"),
		).rejects.toThrow("AUTHENTICATION_REQUIRED");

		expect(requireRelogin).toHaveBeenCalledWith(response);
	});
});
