import { getStorageSection } from "./Section.js";

jest.mock("@data/storage", () => [
	{ id: "local", name: "LOCAL" },
	{ id: "aws", name: "AWS" },
]);

describe("getStorageSection", () => {
	const translations = {
		FOLDER: "Folder",
		STORAGE: "Storage",
		LOCAL: "Local Disk",
	};

	it("returns storage root when path missing", () => {
		const section = getStorageSection({ id: "x", translations });
		expect(section.name).toBe("Storage");
		expect(section.tooltip).toBe("Storage");
	});

	it("resolves device name for top-level path", () => {
		const section = getStorageSection({
			id: "local",
			translations,
			path: "local",
		});
		expect(section.name).toBe("Local Disk");
		expect(section.id).toBe("Local Disk");
	});

	it("returns folder icon for nested paths", () => {
		const section = getStorageSection({
			id: "docs",
			translations,
			path: "local/docs",
		});
		expect(section.name).toBe("docs");
		expect(section.tooltip).toBe("Folder");
	});
});
