import { BookmarksStore as Bookmarks } from "@components/Bookmarks";
import { render, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import BookmarksPage from "./index.js";

jest.mock("@util/translations");
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
jest.mock("@util/views", () => ({
	usePages: jest.fn().mockReturnValue([]),
	getPagesFromHash: jest.fn().mockReturnValue([]),
}));
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children }) => (
	<div data-testid="row">{children}</div>
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
	});

	it("renders bookmarks table and status bar", async () => {
		const { getByTestId } = render(<BookmarksPage />);
		await waitFor(() => {
			expect(getByTestId("table")).toBeInTheDocument();
			expect(getByTestId("status-bar")).toBeInTheDocument();
		});
	});
});
