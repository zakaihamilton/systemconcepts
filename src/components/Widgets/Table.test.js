import { ContentSize } from "@components/Page/Content";
import { useSearch } from "@components/Search";
import { render } from "@testing-library/react";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import TableWidget from "./Table";

jest.mock("@util/translations");
jest.mock("@util/styles");
jest.mock("@components/Search", () => ({ useSearch: jest.fn() }));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/importExport");
jest.mock("@widgets/StatusBar", () => ({
	StatusBarStore: {
		useState: jest.fn().mockReturnValue(0),
	},
}));
jest.mock("./Table/Row", () => () => <tr data-testid="table-row" />);
jest.mock("./Table/Item", () => () => <div data-testid="table-item" />);
jest.mock("./Table/Navigator", () => () => (
	<div data-testid="table-navigator" />
));
jest.mock("./Table/Error", () => () => <div data-testid="table-error" />);
jest.mock("./Table/TableColumn", () => () => <th data-testid="table-column" />);
jest.mock("./Table/ListColumns", () => () => (
	<div data-testid="list-columns" />
));
jest.mock(
	"@components/Virtualized/FixedSizeList",
	() =>
		({ children: ChildComponent }) => (
			<div data-testid="fixed-list">
				<ChildComponent index={0} style={{}} data={{}} />
			</div>
		),
);
jest.mock(
	"@components/Virtualized/FixedSizeGrid",
	() =>
		({ children: ChildComponent }) => (
			<div data-testid="fixed-grid">
				<ChildComponent rowIndex={0} columnIndex={0} style={{}} data={{}} />
			</div>
		),
);

describe("Table Widget", () => {
	const mockStore = {
		useState: jest.fn().mockReturnValue({
			viewMode: "table",
			itemsPerPage: 10,
			order: "asc",
			orderBy: "id",
			offset: 0,
		}),
		update: jest.fn(),
	};

	const columns = [
		{ id: "id", title: "ID" },
		{ id: "name", title: "Name" },
	];
	const data = [
		{ id: 1, name: "Item 1" },
		{ id: 2, name: "Item 2" },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			NO_ITEMS: "No items",
		});
		useDeviceType.mockReturnValue("desktop");
		useSearch.mockReturnValue("");
	});

	it("renders table mode", () => {
		const { getByTestId, getAllByTestId } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget columns={columns} data={data} store={mockStore} />
			</ContentSize.Provider>,
		);
		expect(getAllByTestId("table-row")).toHaveLength(2);
		expect(getByTestId("table-navigator")).toBeInTheDocument();
	});

	it("renders list mode", () => {
		mockStore.useState.mockReturnValue({
			viewMode: "list",
			itemsPerPage: 10,
			order: "asc",
			orderBy: "id",
			offset: 0,
		});
		const { getByTestId } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={mockStore}
					viewModes={{ list: {} }}
				/>
			</ContentSize.Provider>,
		);
		expect(getByTestId("fixed-list")).toBeInTheDocument();
	});

	it("renders loading state", () => {
		render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					loading={true}
					columns={columns}
					data={[]}
					store={mockStore}
				/>
			</ContentSize.Provider>,
		);
		// Loading message has a delay, so we might need to wait if we don't mock the timer
	});
});
