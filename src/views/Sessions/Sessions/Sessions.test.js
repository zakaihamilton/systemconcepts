import { render } from "@testing-library/react";
import { useSessions } from "@util/sessions";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import SessionsPage from "./index.js";

jest.mock("@util/translations");
jest.mock("@util/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn().mockImplementation((selector) =>
			selector({
				viewMode: "list",
				groupFilter: [],
				typeFilter: [],
				yearFilter: [],
				orderBy: "date",
				order: "desc",
				showHistory: false,
				expandedTreeGroups: [],
			}),
		),
		update: jest.fn(),
	},
}));
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/styles");
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue(false),
		update: jest.fn(),
	},
}));
jest.mock("@views/Player/Player", () => ({
	PlayerStore: {
		useState: jest.fn().mockReturnValue({ session: null }),
	},
}));
jest.mock("@util/history", () => ({
	useRecentHistory: jest.fn().mockReturnValue([[]]),
}));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@views/Sessions/FilterBar", () => () => (
	<div data-testid="filter-bar" />
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Image", () => () => <div data-testid="image" />);
jest.mock("@widgets/SessionIcon", () => () => (
	<div data-testid="session-icon" />
));
jest.mock("@widgets/Group", () => () => <div data-testid="group" />);
jest.mock("@widgets/Row", () => ({ children }) => (
	<div data-testid="row">{children}</div>
));
jest.mock("@widgets/Label", () => () => <div data-testid="label" />);
jest.mock("js-cookie", () => ({
	get: jest.fn().mockReturnValue("test"),
}));

describe("Sessions View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			SESSIONS: "Sessions",
			THUMBNAIL: "Thumbnail",
			NAME: "Name",
			DATE: "Date",
			TYPE: "Type",
			DURATION: "Duration",
			GROUP: "Group",
		});
		useDeviceType.mockReturnValue("desktop");
		useSessions.mockReturnValue([[], false]);
	});

	it("renders table and bars", () => {
		const { getByTestId } = render(<SessionsPage />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("filter-bar")).toBeInTheDocument();
		expect(getByTestId("status-bar")).toBeInTheDocument();
	});
});
