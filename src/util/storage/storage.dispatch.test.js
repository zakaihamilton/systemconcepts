import storageDevices from "@data/storage";
import { callMethod } from "@util/storage/storage";

jest.mock("@data/storage", () => []);

describe("storage dispatch", () => {
	it("returns null for an unavailable storage device", async () => {
		expect(storageDevices).toEqual([]);
		await expect(
			callMethod({ name: "readFile" }, "missing/file"),
		).resolves.toBe(null);
	});
});
