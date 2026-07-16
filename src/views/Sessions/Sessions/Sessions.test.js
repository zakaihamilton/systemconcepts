import { fireEvent, render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import SessionsPage from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
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
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/browser/styles");
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
jest.mock("@util/domain/history", () => ({
	useRecentHistory: jest.fn().mockReturnValue([[]]),
}));
jest.mock("@widgets/Table", () => ({ columns, renderColumn, statusBar }) => (
	<div data-testid="table">
		{statusBar}
		<button
			onClick={() =>
				columns
					.find((column) => column.id === "groupWidget")
					.onClick({ group: "test" })
			}
		>
			Filter group
		</button>
		<button
			onClick={() =>
				renderColumn("nameWidget", {
					type: "audio",
					name: "Test session",
				}).props.icons.props.onClick()
			}
		>
			Filter type
		</button>
	</div>
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

	it.each([
		["group", "Filter group"],
		["type", "Filter type"],
	])("shows the filter bar when filtering by %s from the session list", (_, label) => {
		const { getByRole } = render(<SessionsPage />);

		fireEvent.click(getByRole("button", { name: label }));
		const update = SessionsStore.update.mock.calls.at(-1)[0];
		const state = {
			groupFilter: [],
			typeFilter: [],
			showFilterDialog: false,
		};

		update(state);

		expect(state.showFilterDialog).toBe(true);
	});
});
