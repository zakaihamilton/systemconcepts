import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import { useStoreState } from "@util/browser/store";
import { isCompressedJSONFile } from "@util/data/path";
import { useParentPath } from "@util/domain/views";
import { exportData } from "@util/storage/importExport";
import storage from "@util/storage/storage";
import pako from "pako";
import { EditorStore } from "./Editor";
import Editor from "./index.js";

jest.mock("@util/browser/store", () => ({
	useStoreState: jest.fn(),
}));
jest.mock("@widgets/Editor", () => () => <div data-testid="editor-widget" />);
jest.mock("@util/domain/views");
jest.mock("@util/storage/storage", () => ({
	readFile: jest.fn().mockResolvedValue(""),
	writeFile: jest.fn().mockResolvedValue({}),
	createFolderPath: jest.fn().mockResolvedValue({}),
}));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock(
	"@widgets/Download",
	() =>
		({ visible, onClick }) =>
			visible ? (
				<button type="button" data-testid="download" onClick={onClick}>
					download
				</button>
			) : null,
);
jest.mock(
	"@widgets/Save",
	() =>
		({ visible, onClick, saving }) =>
			visible ? (
				<button
					type="button"
					data-testid="save"
					onClick={onClick}
					disabled={saving}
				>
					save
				</button>
			) : null,
);
jest.mock("@util/storage/importExport", () => ({
	exportData: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));
jest.mock("pako", () => ({
	ungzip: jest.fn(),
	gzip: jest.fn(),
}));
jest.mock("@util/data/path", () => {
	const actual = jest.requireActual("@util/data/path");
	return {
		...actual,
		isCompressedJSONFile: jest.fn().mockReturnValue(false),
	};
});

describe("Editor View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		EditorStore.update((s) => {
			s.content = "";
		});
		useStoreState.mockImplementation((_store, selector) => {
			const raw = EditorStore.getRawState();
			const content = Array.isArray(raw.content)
				? raw.content
				: [raw.content ?? ""];
			return selector({ content });
		});
		useParentPath.mockReturnValue("local/test");
		storage.readFile.mockResolvedValue("file content");
		isCompressedJSONFile.mockReturnValue(false);
	});

	it("renders progress while loading", async () => {
		const { getByTestId, queryByTestId } = render(<Editor name="test.txt" />);
		expect(getByTestId("progress")).toBeInTheDocument();
		await waitFor(() =>
			expect(queryByTestId("progress")).not.toBeInTheDocument(),
		);
	});

	it("renders editor widget after loading", async () => {
		const { getByTestId } = render(<Editor name="test.txt" />);
		await waitFor(() => {
			expect(getByTestId("editor-widget")).toBeInTheDocument();
			expect(getByTestId("download")).toBeInTheDocument();
			expect(getByTestId("save")).toBeInTheDocument();
		});
	});

	it("builds the file path from the parent path when none is provided", async () => {
		render(<Editor name="notes.txt" />);
		await waitFor(() => {
			expect(storage.readFile).toHaveBeenCalledWith("test/notes.txt");
		});
	});

	it("decompresses base64 gzip json files on read", async () => {
		isCompressedJSONFile.mockReturnValue(true);
		const bytes = new Uint8Array([1, 2, 3]);
		const base64 = btoa(String.fromCharCode(...bytes));
		storage.readFile.mockResolvedValue(`H4sI${base64}`);
		pako.ungzip.mockReturnValue('{"saved":true}');

		render(<Editor name="data.json.gz" path="local/data.json.gz" />);

		await waitFor(() => {
			expect(pako.ungzip).toHaveBeenCalled();
			expect(EditorStore.getRawState().content).toBe('{"saved":true}');
		});
	});

	it("logs and keeps content when gzip decompression fails", async () => {
		isCompressedJSONFile.mockReturnValue(true);
		storage.readFile.mockResolvedValue("plain-json-content");
		pako.ungzip.mockImplementation(() => {
			throw new Error("bad gzip");
		});

		render(<Editor name="data.json.gz" path="local/data.json.gz" />);

		await waitFor(() => {
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"Failed to decompress .json.gz file:",
				expect.any(Error),
			);
			expect(EditorStore.getRawState().content).toBe("plain-json-content");
		});
	});

	it("compresses json.gz files before saving", async () => {
		isCompressedJSONFile.mockReturnValue(true);
		storage.readFile.mockResolvedValue("loaded");
		pako.gzip.mockReturnValue(new Uint8Array([9, 8, 7]));
		const props = { name: "data.json.gz", path: "local/data.json.gz" };
		const view = render(<Editor {...props} />);
		await waitFor(() => {
			expect(screen.getByTestId("save")).toBeInTheDocument();
		});
		EditorStore.update((s) => {
			s.content = ['{"a":1}'];
		});
		view.rerender(<Editor {...props} />);

		fireEvent.click(screen.getByTestId("save"));

		await waitFor(() => {
			expect(pako.gzip).toHaveBeenCalledWith('{"a":1}');
			expect(storage.writeFile).toHaveBeenCalledWith(
				"local/data.json.gz",
				expect.any(String),
			);
		});
	});

	it("falls back to uncompressed content when gzip compression fails", async () => {
		isCompressedJSONFile.mockReturnValue(true);
		storage.readFile.mockResolvedValue("loaded");
		pako.gzip.mockImplementation(() => {
			throw new Error("compress failed");
		});
		const props = { name: "data.json.gz", path: "local/data.json.gz" };
		const view = render(<Editor {...props} />);
		await waitFor(() => {
			expect(screen.getByTestId("save")).toBeInTheDocument();
		});
		EditorStore.update((s) => {
			s.content = ['{"a":1}'];
		});
		view.rerender(<Editor {...props} />);

		fireEvent.click(screen.getByTestId("save"));

		await waitFor(() => {
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"Failed to compress .json.gz file:",
				expect.any(Error),
			);
			expect(storage.writeFile).toHaveBeenCalledWith(
				"local/data.json.gz",
				'{"a":1}',
			);
		});
	});

	it("exports the current file when download is clicked", async () => {
		const props = { name: "notes.txt", path: "local/notes.txt" };
		const view = render(<Editor {...props} />);
		await waitFor(() => {
			expect(screen.getByTestId("download")).toBeInTheDocument();
		});
		EditorStore.update((s) => {
			s.content = ["export me"];
		});
		view.rerender(<Editor {...props} />);

		fireEvent.click(screen.getByTestId("download"));
		expect(exportData).toHaveBeenCalledWith(
			"export me",
			"notes.txt",
			"text/plain",
		);
	});
});
