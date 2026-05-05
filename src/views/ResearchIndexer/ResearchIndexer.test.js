import { render, waitFor } from "@testing-library/react";
import storage from "@util/storage";
import { useTranslations } from "@util/translations";
import { ResearchStore } from "../ResearchStore/ResearchStore";
import ResearchIndexer from "./ResearchIndexer";

jest.mock("@util/translations");
jest.mock("../ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn().mockReturnValue({ indexing: false }),
		update: jest.fn(),
	},
}));
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/storage");
jest.mock("@util/searchIndexBinary");

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
