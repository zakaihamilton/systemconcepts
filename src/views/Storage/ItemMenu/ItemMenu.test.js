import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { exportData } from "@util/storage/importExport";
import storage from "@util/storage/storage";
import { StorageStore } from "../Storage";
import ItemMenuWidget from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/storage/storage");
jest.mock("@util/storage/importExport", () => ({
	exportData: jest.fn(),
}));
jest.mock("../Storage", () => ({
	StorageStore: {
		update: jest.fn(),
	},
}));
jest.mock("@components/ItemMenu", () => ({ menuItems }) => (
	<div data-testid="item-menu">
		{(menuItems || []).map((item) => (
			<button
				key={item.id}
				type="button"
				data-testid={`menu-${item.id}`}
				onClick={() => item.onClick?.()}
			>
				{item.name}
			</button>
		))}
	</div>
));

const translations = {
	RENAME: "Rename",
	MOVE: "Move",
	COPY: "Copy",
	DELETE: "Delete",
	EXPORT: "Export",
	FOLDER_NAME_PLACEHOLDER: "Folder name",
	FILE_NAME_PLACEHOLDER: "File name",
	ALREADY_EXISTS: "Already exists: ${name}",
};

describe("Storage ItemMenu", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(translations);
		StorageStore.update.mockImplementation((fn) => {
			const state = {};
			fn(state);
			return state;
		});
	});

	it("renders write actions plus export when not read-only", () => {
		render(
			<ItemMenuWidget
				item={{ type: "file", name: "a.txt", path: "/root/a.txt" }}
			/>,
		);
		expect(screen.getByTestId("menu-rename")).toBeInTheDocument();
		expect(screen.getByTestId("menu-move")).toBeInTheDocument();
		expect(screen.getByTestId("menu-copy")).toBeInTheDocument();
		expect(screen.getByTestId("menu-delete")).toBeInTheDocument();
		expect(screen.getByTestId("menu-export")).toBeInTheDocument();
	});

	it("hides write actions when readOnly", () => {
		render(
			<ItemMenuWidget
				readOnly
				item={{ type: "file", name: "a.txt", path: "/root/a.txt" }}
			/>,
		);
		expect(screen.queryByTestId("menu-rename")).not.toBeInTheDocument();
		expect(screen.queryByTestId("menu-move")).not.toBeInTheDocument();
		expect(screen.queryByTestId("menu-copy")).not.toBeInTheDocument();
		expect(screen.queryByTestId("menu-delete")).not.toBeInTheDocument();
		expect(screen.getByTestId("menu-export")).toBeInTheDocument();
	});

	it("enters rename mode for a file and validates names", async () => {
		const item = {
			type: "file",
			name: "a.txt",
			path: "/root/a.txt",
			icon: "icon",
			tooltip: "tip",
		};
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-rename"));

		const renameState = {};
		StorageStore.update.mock.calls[0][0](renameState);
		expect(renameState.mode).toBe("rename");
		expect(renameState.type).toBe("file");
		expect(renameState.placeholder).toBe("File name");
		expect(renameState.editing).toBe(true);

		await expect(renameState.onValidate("")).resolves.toBe(false);
		await expect(renameState.onValidate("a.txt")).resolves.toBe(false);
		await expect(renameState.onValidate("b.txt")).resolves.toBe(true);
	});

	it("renames a file and surfaces conflicts", async () => {
		const item = {
			type: "file",
			name: "a.txt",
			path: "/root/a.txt",
		};
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-rename"));
		const renameState = {};
		StorageStore.update.mock.calls[0][0](renameState);

		storage.exists.mockResolvedValueOnce(true);
		await renameState.onDone("taken.txt");
		expect(StorageStore.update).toHaveBeenCalled();
		const errorUpdate = StorageStore.update.mock.calls.at(-1)[0];
		const errState = {};
		errorUpdate(errState);
		expect(errState.severity).toBe("error");
		expect(errState.message).toContain("taken.txt");

		storage.exists.mockResolvedValueOnce(false);
		storage.moveFile.mockResolvedValueOnce(undefined);
		await renameState.onDone("ok/name.txt");
		expect(storage.moveFile).toHaveBeenCalled();
	});

	it("renames a directory via moveFolder", async () => {
		const item = {
			type: "dir",
			name: "folder",
			path: "/root/folder",
		};
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-rename"));
		const renameState = {};
		StorageStore.update.mock.calls[0][0](renameState);
		expect(renameState.placeholder).toBe("Folder name");

		storage.exists.mockResolvedValueOnce(false);
		storage.moveFolder.mockResolvedValueOnce(undefined);
		await renameState.onDone("renamed");
		expect(storage.moveFolder).toHaveBeenCalled();
	});

	it("handles rename storage errors", async () => {
		const item = { type: "file", name: "a.txt", path: "/root/a.txt" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-rename"));
		const renameState = {};
		StorageStore.update.mock.calls[0][0](renameState);
		storage.exists.mockResolvedValueOnce(false);
		storage.moveFile.mockRejectedValueOnce("boom");
		await renameState.onDone("b.txt");
		const errState = {};
		StorageStore.update.mock.calls.at(-1)[0](errState);
		expect(errState.message).toBe("boom");
		expect(errState.severity).toBe("error");
	});

	it("sets move mode and destination on done", () => {
		const item = { type: "file", name: "a.txt", path: "/root/a.txt" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-move"));
		const moveState = {};
		StorageStore.update.mock.calls[0][0](moveState);
		expect(moveState.mode).toBe("move");
		expect(moveState.select).toEqual([item]);
		expect(moveState.onDone()).toBe(true);
		const destState = {};
		StorageStore.update.mock.calls.at(-1)[0](destState);
		expect(destState.destination).toBeDefined();
	});

	it("sets copy mode and destination on done", () => {
		const item = { type: "file", name: "a.txt", path: "/root/a.txt" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-copy"));
		const copyState = {};
		StorageStore.update.mock.calls[0][0](copyState);
		expect(copyState.mode).toBe("copy");
		expect(copyState.onDone()).toBe(true);
	});

	it("deletes files and folders and skips falsy items", async () => {
		const item = { type: "file", name: "a.txt", path: "/root/a.txt" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-delete"));
		const deleteState = {};
		StorageStore.update.mock.calls[0][0](deleteState);
		expect(deleteState.mode).toBe("delete");
		expect(deleteState.severity).toBe("error");

		storage.deleteFile.mockResolvedValueOnce(undefined);
		storage.deleteFolder.mockResolvedValueOnce(undefined);
		await deleteState.onDone([
			null,
			{ type: "file", path: "/root/a.txt" },
			{ type: "dir", path: "/root/dir" },
		]);
		expect(storage.deleteFile).toHaveBeenCalledWith("/root/a.txt");
		expect(storage.deleteFolder).toHaveBeenCalledWith("/root/dir");
	});

	it("surfaces delete errors", async () => {
		const item = { type: "dir", name: "d", path: "/root/d" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-delete"));
		const deleteState = {};
		StorageStore.update.mock.calls[0][0](deleteState);
		storage.deleteFolder.mockRejectedValueOnce("fail");
		await deleteState.onDone([item]);
		const errState = {};
		StorageStore.update.mock.calls.at(-1)[0](errState);
		expect(errState.message).toBe("fail");
	});

	it("exports a directory as zip", async () => {
		storage.exportFolderAsZip.mockResolvedValueOnce("zip-data");
		const item = { type: "dir", name: "folder", path: "/root/folder" };
		render(<ItemMenuWidget item={item} />);
		fireEvent.click(screen.getByTestId("menu-export"));
		await waitFor(() => {
			expect(exportData).toHaveBeenCalledWith(
				"zip-data",
				"folder.zip",
				"application/zip",
			);
		});
	});

	it("exports a text file as json and a binary file as octet-stream", async () => {
		storage.readFile.mockResolvedValueOnce("file-body");
		const { unmount } = render(
			<ItemMenuWidget
				item={{ type: "file", name: "notes.txt", path: "/root/notes.txt" }}
			/>,
		);
		fireEvent.click(screen.getByTestId("menu-export"));
		await waitFor(() => {
			expect(exportData).toHaveBeenCalledWith(
				"file-body",
				"notes.txt",
				"application/json",
			);
		});
		unmount();

		jest.clearAllMocks();
		useTranslations.mockReturnValue(translations);
		storage.readFile.mockResolvedValueOnce(new Uint8Array([1, 2]));
		render(
			<ItemMenuWidget
				item={{ type: "file", name: "a.bin", path: "/root/a.bin" }}
			/>,
		);
		fireEvent.click(screen.getByTestId("menu-export"));
		await waitFor(() => {
			expect(exportData).toHaveBeenCalledWith(
				expect.anything(),
				"a.bin",
				"application/octet-stream",
			);
		});
	});
});
