import { useSync } from "@sync/sync";
import { render } from "@testing-library/react";
import { useResize } from "@util/browser/size";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useLanguage } from "@util/domain/language";
import Main, { MAIN_STORE_PERSISTED_FIELDS, MainStore } from "./index.js";

jest.mock("@util/browser/size");
jest.mock("@util/domain/language");
jest.mock("@util/browser/styles");
jest.mock("@util/browser/store");
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0, false]),
}));
jest.mock("../SideBar", () => () => <div data-testid="sidebar" />);
jest.mock("../Page", () => () => <div data-testid="page" />);
jest.mock("../Sync", () => ({ children }) => (
	<div data-testid="sync">{children}</div>
));
jest.mock("../Head", () => () => <div data-testid="head" />);
jest.mock("../Bookmarks", () => () => <div data-testid="bookmarks" />);
jest.mock("../Title", () => () => <div data-testid="title" />);

describe("Main Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useResize.mockReturnValue(0);
		useLanguage.mockReturnValue("eng");
		useDeviceType.mockReturnValue("desktop");
		MainStore.update((s) => {
			s.direction = "ltr";
			s.showSideBar = true;
			s.libraryExpanded = false;
			s.hash = undefined;
		});
		window.location.hash = "";
	});

	it("renders core components", () => {
		const { getByTestId } = render(<Main />);
		expect(getByTestId("sidebar")).toBeInTheDocument();
		expect(getByTestId("page")).toBeInTheDocument();
		expect(getByTestId("sync")).toBeInTheDocument();
		expect(getByTestId("head")).toBeInTheDocument();
		expect(getByTestId("bookmarks")).toBeInTheDocument();
		expect(getByTestId("title")).toBeInTheDocument();
	});

	it("starts the app-wide auto-sync scheduler", () => {
		render(<Main />);
		expect(useSync).toHaveBeenCalledWith({ schedule: true });
	});

	it("does not auto-sync when the window opens directly on the Sync page", () => {
		window.location.hash = "#sync";

		render(<Main />);

		expect(useSync).toHaveBeenCalledWith({ schedule: false });
	});

	it("persists MainStore UI prefs without the navigation hash", () => {
		render(<Main />);
		expect(useLocalStorage).toHaveBeenCalledWith(
			"MainStore",
			MainStore,
			MAIN_STORE_PERSISTED_FIELDS,
		);
		expect(MAIN_STORE_PERSISTED_FIELDS).not.toContain("hash");
	});

	it("sets html dir attribute based on language", () => {
		useLanguage.mockReturnValue("heb");
		render(<Main />);
		expect(document.getElementsByTagName("html")[0].getAttribute("dir")).toBe(
			"rtl",
		);
	});

	it("updates hash in store on mount", () => {
		window.location.hash = "#test";
		render(<Main />);
		expect(MainStore.getRawState().hash).toBe("#test");
	});

	it("keeps deep-link hashes from the address bar on mount", () => {
		window.location.hash = "#library/id/5c665fb30551dbb6a6615a92";
		render(<Main />);
		expect(MainStore.getRawState().hash).toBe(
			"#library/id/5c665fb30551dbb6a6615a92",
		);
	});
});
