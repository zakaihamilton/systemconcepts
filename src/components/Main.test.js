import { render } from "@testing-library/react";
import { useLanguage } from "@util/language";
import { useResize } from "@util/size";
import { useDeviceType } from "@util/styles";
import Main, { MainStore } from "./Main";

jest.mock("@util/size");
jest.mock("@util/language");
jest.mock("@util/styles");
jest.mock("@util/store");
jest.mock("./SideBar", () => () => <div data-testid="sidebar" />);
jest.mock("./Page", () => () => <div data-testid="page" />);
jest.mock("./Sync", () => ({ children }) => (
	<div data-testid="sync">{children}</div>
));
jest.mock("./Head", () => () => <div data-testid="head" />);
jest.mock("./Bookmarks", () => () => <div data-testid="bookmarks" />);
jest.mock("./Title", () => () => <div data-testid="title" />);

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
		});
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
});
