import { BookmarksStore as Bookmarks } from "@components/Bookmarks";
import { MainStore } from "@components/Main";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { getPagesFromHash, usePages } from "@util/domain/views";
import BookmarksPage, {
	BookmarksStore,
	BookmarksStoreDefaults,
} from "./Bookmarks.js";

jest.mock("@util/domain/translations");
jest.mock("@components/Bookmarks", () => ({
	BookmarksStore: {
		useState: jest.fn().mockReturnValue({ bookmarks: [] }),
		update: jest.fn(),
	},
}));
jest.mock("@components/Main", () => ({
	MainStore: {
		update: jest.fn(),
	},
}));
jest.mock("@util/domain/views", () => ({
	usePages: jest.fn().mockReturnValue([]),
	getPagesFromHash: jest.fn().mockReturnValue([{ id: "a" }, { id: "b" }]),
}));
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock(
	"@widgets/Table",
	() =>
		({ data, mapper, onImport, refresh, statusBar }) => (
			<div data-testid="table">
				{statusBar}
				<button
					type="button"
					data-testid="import"
					onClick={() => onImport({ bookmarks: [{ id: "#x", name: "X" }] })}
				>
					import
				</button>
				<button type="button" data-testid="refresh" onClick={refresh}>
					refresh
				</button>
				{(data || []).map((item) => {
					const mapped = mapper(item);
					return (
						<div key={item.id} data-testid={`bm-${item.id}`}>
							{mapped.nameWidget}
							{mapped.locationWidget}
						</div>
					);
				})}
			</div>
		),
);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children, onClick, href }) => (
	<button type="button" data-href={href} onClick={onClick}>
		{children}
	</button>
));
jest.mock("@components/Breadcrumbs", () => () => (
	<div data-testid="breadcrumbs" />
));
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);

describe("Bookmarks View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ NAME: "Name", LOCATION: "Location" });
		Bookmarks.useState.mockReturnValue({ bookmarks: [] });
		BookmarksStore.update((s) => {
			Object.assign(s, BookmarksStoreDefaults);
			s.viewMode = "table";
			s.select = null;
		});
		window.location.hash = "";
	});

	it("renders bookmarks table and status bar", async () => {
		const { getByTestId } = render(<BookmarksPage />);
		await waitFor(() => {
			expect(getByTestId("table")).toBeInTheDocument();
			expect(getByTestId("status-bar")).toBeInTheDocument();
		});
	});

	it("navigates on bookmark click when not selecting", () => {
		Bookmarks.useState.mockReturnValue({
			bookmarks: [{ id: "#sessions", name: "Sessions" }],
		});
		render(<BookmarksPage />);
		fireEvent.click(screen.getByText("Sessions"));
		expect(MainStore.update).toHaveBeenCalled();
		expect(window.location.hash).toBe("#sessions");
		expect(getPagesFromHash).toHaveBeenCalled();
		expect(usePages).toHaveBeenCalled();
	});

	it("toggles selection when select mode is active", () => {
		const item = { id: "#a", name: "A" };
		Bookmarks.useState.mockReturnValue({ bookmarks: [item] });
		const { rerender } = render(<BookmarksPage />);
		// Mount effect resets defaults; enable select mode afterward
		act(() => {
			BookmarksStore.update((s) => {
				s.select = [];
			});
		});
		rerender(<BookmarksPage />);
		fireEvent.click(screen.getByText("A"));
		expect(BookmarksStore.getRawState().select).toEqual([item]);

		rerender(<BookmarksPage />);
		fireEvent.click(screen.getByText("A"));
		expect(BookmarksStore.getRawState().select).toEqual([]);
	});

	it("imports bookmarks and refreshes counter", () => {
		render(<BookmarksPage />);
		fireEvent.click(screen.getByTestId("import"));
		expect(Bookmarks.update).toHaveBeenCalled();
		const before = BookmarksStore.getRawState().counter;
		fireEvent.click(screen.getByTestId("refresh"));
		expect(BookmarksStore.getRawState().counter).toBe(before + 1);
	});
});
