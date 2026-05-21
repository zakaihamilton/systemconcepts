import { render, waitFor } from "@testing-library/react";
import storage from "@util/storage";
import { useStoreState } from "@util/store";
import { useParentPath } from "@util/views";
import Editor from "./Editor";

jest.mock("@util/store", () => ({
	useStoreState: jest.fn(),
}));
jest.mock("@widgets/Editor", () => () => <div data-testid="editor-widget" />);
jest.mock("@util/views");
jest.mock("@util/storage", () => ({
	readFile: jest.fn().mockResolvedValue(""),
	writeFile: jest.fn().mockResolvedValue({}),
	createFolderPath: jest.fn().mockResolvedValue({}),
}));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock("@widgets/Download", () => () => <div data-testid="download" />);
jest.mock("@widgets/Save", () => () => <div data-testid="save" />);
jest.mock("@util/importExport");
jest.mock("pako");
jest.mock("@util/path");

describe("Editor View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useStoreState.mockReturnValue({ content: [""] });
		useParentPath.mockReturnValue("local/test");
		storage.readFile.mockResolvedValue("file content");
	});

	it("renders progress while loading", async () => {
		const { getByTestId, queryByTestId } = render(<Editor name="test.txt" />);
		expect(getByTestId("progress")).toBeInTheDocument();
		await waitFor(() => expect(queryByTestId("progress")).not.toBeInTheDocument());
	});

	it("renders editor widget after loading", async () => {
		const { getByTestId } = render(<Editor name="test.txt" />);
		await waitFor(() => {
			expect(getByTestId("editor-widget")).toBeInTheDocument();
			expect(getByTestId("download")).toBeInTheDocument();
			expect(getByTestId("save")).toBeInTheDocument();
		});
	});
});
