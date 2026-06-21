import { findMissingManifestFiles } from "./freshness";

describe("findMissingManifestFiles", () => {
	it("returns manifest files that are absent locally", async () => {
		const exists = jest.fn(async (path) => !path.endsWith("/group/2022.json"));

		await expect(
			findMissingManifestFiles(
				[{ path: "/group/2022.json" }, { path: "/group/2026.json" }],
				"local/sync",
				exists,
			),
		).resolves.toEqual(["/group/2022.json"]);
	});

	it("ignores deleted and invalid manifest entries", async () => {
		const exists = jest.fn(async () => false);

		await expect(
			findMissingManifestFiles(
				[{ path: "/old.json", deleted: true }, {}, null],
				"local/sync",
				exists,
			),
		).resolves.toEqual([]);
		expect(exists).not.toHaveBeenCalled();
	});
});
