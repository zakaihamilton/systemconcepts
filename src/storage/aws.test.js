import storage from "@storage/aws";
import { fetchJSON, requireRelogin } from "@util/api/fetch";

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

	it("requests directory counts in the original listing call", async () => {
		fetchJSON.mockResolvedValue([
			{ type: "dir", name: "2025", count: 12 },
			{ type: "dir", name: "2026", count: 4 },
		]);

		const listing = await storage.getListing("sessions", { useCount: true });

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		expect(fetchJSON).toHaveBeenCalledWith(
			"/api/aws?path=sessions&type=dir&counts=1",
			{ method: "GET", cache: "no-store" },
		);
		expect(listing.map(({ name, count }) => ({ name, count }))).toEqual([
			{ name: "2025", count: 12 },
			{ name: "2026", count: 4 },
		]);
	});
});
