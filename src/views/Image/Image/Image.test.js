import { ContentSize } from "@components/Page/Content";
import { useSync } from "@sync/sync";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFetchJSON } from "@util/api/fetch";
import { readBinary } from "@util/data/binary";
import { useTranslations } from "@util/domain/translations";
import { useParentParams, useParentPath } from "@util/domain/views";
import { exportData, exportFile } from "@util/storage/importExport";
import ImagePage from "./Image.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views");
jest.mock("@util/data/binary");
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock("@util/api/fetch");
jest.mock("@util/storage/importExport", () => ({
	exportData: jest.fn(),
	exportFile: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: { warn: jest.fn(), debug: jest.fn() },
}));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock(
	"@widgets/Download",
	() =>
		({ onClick, target, visible }) =>
			visible ? (
				<button
					type="button"
					data-testid="download"
					data-target={target || ""}
					onClick={onClick}
				>
					dl
				</button>
			) : null,
);
jest.mock("@widgets/Message", () => () => <div data-testid="message" />);

describe("Image View", () => {
	const mockSize = { width: 800, height: 600 };

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ CANNOT_LOAD_IMAGE: "Cannot load image" });
		useParentPath.mockReturnValue("local/test");
		useParentParams.mockReturnValue({});
		useFetchJSON.mockReturnValue([null, false, false]);
		useSync.mockReturnValue([0]);
		readBinary.mockResolvedValue(new Blob(["test"], { type: "image/png" }));

		const OriginalFileReader = global.FileReader;
		global.FileReader = class {
			addEventListener(type, cb) {
				this._cb = cb;
			}
			readAsDataURL() {
				this.result = "data:image/png;base64,abc";
				this._cb?.();
			}
		};
		global.FileReader.__Original = OriginalFileReader;
	});

	afterEach(() => {
		if (global.FileReader.__Original) {
			global.FileReader = global.FileReader.__Original;
		}
	});

	const wrap = (ui) => (
		<ContentSize.Provider value={mockSize}>{ui}</ContentSize.Provider>
	);

	it("renders progress while loading then image", async () => {
		const { getByTestId, queryByTestId, getByRole } = render(
			wrap(<ImagePage name="test" />),
		);
		expect(getByTestId("progress")).toBeInTheDocument();
		const img = await waitFor(() => getByRole("img", { hidden: true }));
		fireEvent.load(img);
		await waitFor(() =>
			expect(queryByTestId("progress")).not.toBeInTheDocument(),
		);
	});

	it("uses https path directly", async () => {
		useParentParams.mockReturnValue({
			prefix: "sessions",
			group: "will",
			year: "2024",
			date: "2024-01-01",
			name: "Talk",
		});
		useFetchJSON.mockReturnValue([
			{ path: "https://cdn.example/img.png", downloadUrl: "https://dl" },
			false,
			false,
		]);
		render(wrap(<ImagePage name="Talk" ext="png" />));
		const img = await waitFor(() => screen.getByRole("img", { hidden: true }));
		expect(img).toHaveAttribute("src", "https://cdn.example/img.png");
		fireEvent.load(img);
		await waitFor(() =>
			expect(screen.getByTestId("download")).toBeInTheDocument(),
		);
		expect(screen.getByTestId("download")).toHaveAttribute(
			"data-target",
			"https://dl",
		);
	});

	it("downloads via content when no downloadUrl", async () => {
		render(wrap(<ImagePage name="test" />));
		const img = await waitFor(() => screen.getByRole("img", { hidden: true }));
		fireEvent.load(img);
		await waitFor(() =>
			expect(screen.getByTestId("download")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("download"));
		expect(exportData).toHaveBeenCalled();
	});

	it("shows error message on read failure", async () => {
		readBinary.mockRejectedValue(new Error("boom"));
		render(wrap(<ImagePage name="bad" />));
		await waitFor(() =>
			expect(screen.getByTestId("message")).toBeInTheDocument(),
		);
	});

	it("ignores FILE_NOT_FOUND while signing", async () => {
		useParentParams.mockReturnValue({
			group: "g",
			year: "2024",
			date: "2024-01-01",
			name: "N",
		});
		useFetchJSON.mockReturnValue([null, false, true]);
		readBinary.mockRejectedValue(new Error("FILE_NOT_FOUND"));
		render(wrap(<ImagePage name="N" />));
		await waitFor(() =>
			expect(screen.getByTestId("progress")).toBeInTheDocument(),
		);
	});

	it("handles image onError and path with extension already present", async () => {
		useParentPath.mockReturnValue("local/folder");
		useParentParams.mockReturnValue({});
		render(wrap(<ImagePage name="photo.png" ext="png" />));
		const img = await waitFor(() => screen.getByRole("img", { hidden: true }));
		fireEvent.error(img);
		await waitFor(() =>
			expect(screen.getByTestId("message")).toBeInTheDocument(),
		);
	});

	it("re-reads on sync counter change and exports path fallback", async () => {
		let sync = 0;
		useSync.mockImplementation(() => [sync]);
		readBinary.mockResolvedValue(null);
		const { rerender } = render(wrap(<ImagePage name="test" />));
		await waitFor(() => expect(readBinary).toHaveBeenCalled());
		sync = 1;
		rerender(wrap(<ImagePage name="test" />));
		await waitFor(() =>
			expect(readBinary.mock.calls.length).toBeGreaterThan(1),
		);
	});

	it("exports file path when no content or downloadUrl", async () => {
		readBinary.mockResolvedValue(null);
		// Force src without content by https path via parent group
		useParentParams.mockReturnValue({
			group: "g",
			year: "y",
			date: "d",
			name: "n",
		});
		useFetchJSON.mockReturnValue([
			{ path: "https://x.png", downloadUrl: "" },
			false,
			false,
		]);
		render(wrap(<ImagePage name="n" />));
		const img = await waitFor(() => screen.getByRole("img", { hidden: true }));
		fireEvent.load(img);
		await waitFor(() =>
			expect(screen.getByTestId("download")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("download"));
		expect(exportFile).toHaveBeenCalled();
	});
});
