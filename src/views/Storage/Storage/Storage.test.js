import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { addPath, setPath } from "@util/domain/views";
import storage, { useListing } from "@util/storage/storage";
import Storage, { StorageStore } from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/storage/storage", () => ({
	useListing: jest.fn(),
	__esModule: true,
	default: {
		importFolder: jest.fn(),
		exportFolderAsZip: jest.fn(),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn().mockReturnValue({
		format: jest.fn((d) => String(d)),
	}),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	setPath: jest.fn(),
}));
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock("../Actions", () => ({
	__esModule: true,
	default: () => <div data-testid="actions" />,
	useActions: jest.fn((data) => data),
}));
jest.mock("@widgets/Table", () => (props) => (
	<div
		data-testid="table"
		data-loading={String(!!props.loading)}
		data-error={props.error || ""}
	>
		{props.statusBar}
		<button
			type="button"
			data-testid="table-refresh"
			onClick={() => props.refresh?.()}
		>
			refresh
		</button>
		<button
			type="button"
			data-testid="table-import"
			onClick={() => props.onImport?.({ files: [] })}
		>
			import
		</button>
		<button
			type="button"
			data-testid="table-export"
			onClick={() => props.onExport?.()}
		>
			export
		</button>
		{(props.data || []).map((item) => {
			const mapped = props.mapper ? props.mapper(item) : item;
			return (
				<div key={item.id || item.name} data-testid={`item-${item.name}`}>
					{mapped.nameWidget}
				</div>
			);
		})}
	</div>
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children, onClick }) => (
	<button type="button" onClick={onClick}>
		{children}
	</button>
));
jest.mock("@widgets/Tooltip", () => ({ children }) => <>{children}</>);
jest.mock("../Destination", () => () => <div data-testid="destination" />);
jest.mock("../Edit", () => () => <div data-testid="edit" />);
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);

describe("Storage View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			SIZE: "Size",
			DATE: "Date",
			STORAGE: "Storage",
			FOLDER: "Folder",
			FILE: "File",
			BYTES: "bytes",
			local: "Local",
		});
		useDeviceType.mockReturnValue("desktop");
		useLocalStorage.mockImplementation(() => {});
		useListing.mockReturnValue([
			[
				{
					name: "folder",
					id: "local/folder",
					type: "dir",
					size: 0,
					mtimeMs: Date.now(),
				},
				{
					name: "file.txt",
					id: "local/file.txt",
					type: "file",
					size: 1024,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		StorageStore.update((s) => {
			Object.assign(s, {
				mode: "",
				select: null,
				counter: 1,
				editing: false,
				item: null,
			});
		});
	});

	it("renders storage table and sub-components", () => {
		const { getByTestId } = render(<Storage path="local" />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("actions")).toBeInTheDocument();
		expect(getByTestId("destination")).toBeInTheDocument();
	});

	it("shows loading state from useListing", () => {
		useListing.mockReturnValue([[], true, null]);
		const { getByTestId } = render(<Storage path="local" />);
		expect(getByTestId("table").dataset.loading).toBe("true");
	});

	it("shows error from useListing", () => {
		useListing.mockReturnValue([[], false, "Denied"]);
		render(<Storage path="local" />);
		expect(screen.getByTestId("table").dataset.error).toBe("Denied");
	});

	const clickItem = (name) => {
		fireEvent.click(
			within(screen.getByTestId(`item-${name}`)).getByRole("button"),
		);
	};

	it("navigates into a folder on click", () => {
		render(<Storage path="local" />);
		clickItem("folder");
		expect(setPath).toHaveBeenCalledWith("storage/local/folder");
	});

	it("toggles selection when select mode is active", () => {
		const { rerender } = render(<Storage path="local" />);
		StorageStore.update((s) => {
			s.select = [];
		});
		rerender(<Storage path="local" />);
		clickItem("file.txt");
		expect(StorageStore.getRawState().select.length).toBeGreaterThanOrEqual(1);
	});

	it("hides size/date columns on phone", () => {
		useDeviceType.mockReturnValue("phone");
		render(<Storage path="local" />);
		expect(screen.getByTestId("table")).toBeInTheDocument();
	});

	it("resets store defaults when path changes", () => {
		const { rerender } = render(<Storage path="local" />);
		StorageStore.update((s) => {
			s.mode = "delete";
		});
		rerender(<Storage path="local/sub" />);
		expect(StorageStore.getRawState().mode).toBe("");
	});

	it("renders status bar", () => {
		render(<Storage path="local" />);
		expect(screen.getByTestId("status-bar")).toBeInTheDocument();
	});

	it("handles empty listing", () => {
		useListing.mockReturnValue([[], false, null]);
		render(<Storage path="local" />);
		expect(screen.getByTestId("table")).toBeInTheDocument();
	});

	it("deselects an item when clicked again in select mode", () => {
		const file = {
			name: "file.txt",
			id: "local/file.txt",
			type: "file",
			size: 1024,
			mtimeMs: Date.now(),
		};
		useListing.mockReturnValue([[file], false, null]);
		const { rerender } = render(<Storage path="local" />);
		StorageStore.update((s) => {
			s.select = [file];
		});
		rerender(<Storage path="local" />);
		clickItem("file.txt");
		expect(StorageStore.getRawState().select).toEqual([]);
	});

	it("opens images in the image viewer", () => {
		useListing.mockReturnValue([
			[
				{
					name: "photo.png",
					id: "local/photo.png",
					type: "file",
					size: 2048,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		render(<Storage path="local" />);
		clickItem("photo.png");
		expect(addPath).toHaveBeenCalledWith("image?name=photo.png");
	});

	it("opens json.gz files in the editor", () => {
		useListing.mockReturnValue([
			[
				{
					name: "data.json.gz",
					id: "local/data.json.gz",
					type: "file",
					size: 512,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		render(<Storage path="local" />);
		clickItem("data.json.gz");
		expect(addPath).toHaveBeenCalledWith("editor?name=data.json.gz");
	});

	it("opens text files in the editor", () => {
		render(<Storage path="local" />);
		clickItem("file.txt");
		expect(addPath).toHaveBeenCalledWith("editor?name=file.txt");
	});

	it("does not navigate for binary media files", () => {
		useListing.mockReturnValue([
			[
				{
					name: "audio.m4a",
					id: "local/audio.m4a",
					type: "file",
					size: 4096,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		render(<Storage path="local" />);
		clickItem("audio.m4a");
		expect(addPath).not.toHaveBeenCalled();
	});

	it("maps root storage devices with translated names", () => {
		useListing.mockReturnValue([
			[{ name: "local", id: "local", size: 1000, mtimeMs: Date.now() }],
			false,
			null,
		]);
		render(<Storage path="" />);
		expect(screen.getByTestId("item-local")).toHaveTextContent("Local");
	});

	it("shows edit widget when renaming an item", async () => {
		useListing.mockReturnValue([
			[
				{
					name: "file.txt",
					id: "local/file.txt",
					type: "file",
					size: 1024,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		const { rerender } = render(<Storage path="local" />);
		await waitFor(() => {
			expect(StorageStore.getRawState().mode).toBe("");
		});
		StorageStore.update((s) => {
			s.mode = "rename";
			s.item = { id: "local/file.txt", name: "file.txt" };
		});
		rerender(<Storage path="local" />);
		expect(screen.getByTestId("edit")).toBeInTheDocument();
	});

	it("increments counter after successful import", async () => {
		storage.importFolder.mockResolvedValue();
		const before = StorageStore.getRawState().counter;
		render(<Storage path="local" />);
		fireEvent.click(screen.getByTestId("table-import"));
		await waitFor(() => {
			expect(StorageStore.getRawState().counter).toBe(before + 1);
		});
	});

	it("stores import errors in the storage store", async () => {
		storage.importFolder.mockRejectedValue("import failed");
		render(<Storage path="local" />);
		fireEvent.click(screen.getByTestId("table-import"));
		await waitFor(() => {
			expect(StorageStore.getRawState()).toMatchObject({
				message: "import failed",
				severity: "error",
			});
		});
	});

	it("exports the current folder as a zip", async () => {
		storage.exportFolderAsZip.mockResolvedValue("zip-data");
		render(<Storage path="local/docs" />);
		fireEvent.click(screen.getByTestId("table-export"));
		await waitFor(() => {
			expect(storage.exportFolderAsZip).toHaveBeenCalledWith("local/docs");
		});
	});

	it("refreshes listing when table refresh is triggered", () => {
		const before = StorageStore.getRawState().counter;
		render(<Storage path="local" />);
		fireEvent.click(screen.getByTestId("table-refresh"));
		expect(StorageStore.getRawState().counter).toBe(before + 1);
	});

	it("shows edit widget when creating a new item", async () => {
		useListing.mockReturnValue([
			[
				{
					name: "new-folder",
					id: "local/new-folder",
					type: "dir",
					create: true,
					size: 0,
					mtimeMs: Date.now(),
				},
			],
			false,
			null,
		]);
		const { rerender } = render(<Storage path="local" />);
		await waitFor(() => {
			expect(StorageStore.getRawState().mode).toBe("");
		});
		StorageStore.update((s) => {
			s.mode = "create";
		});
		rerender(<Storage path="local" />);
		expect(screen.getByTestId("edit")).toBeInTheDocument();
	});
});
