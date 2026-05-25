import { render, waitFor } from "@testing-library/react";
import storage from "@util/storage/storage";
import { useTranslations } from "@util/domain/translations";
import { ResearchStore } from "../../ResearchStore/ResearchStore";
import ResearchIndexer from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("../../ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn().mockReturnValue({ indexing: false }),
		update: jest.fn(),
	},
}));
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/storage/storage");
jest.mock("@util/data/searchIndexBinary");

describe("ResearchIndexer Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			LOADING_TAGS: "Loading tags",
			DONE: "Done",
		});
		ResearchStore.useState.mockReturnValue({ indexing: false });
	});

	it("renders nothing", () => {
		const { container } = render(<ResearchIndexer />);
		expect(container.firstChild).toBeNull();
	});

	it("starts indexing when indexing state becomes true", async () => {
		ResearchStore.useState.mockReturnValue({ indexing: true });
		storage.exists.mockResolvedValue(false); // tags.json not found

		render(<ResearchIndexer />);

		await waitFor(() => {
			expect(ResearchStore.update).toHaveBeenCalled();
		});
	});
});
