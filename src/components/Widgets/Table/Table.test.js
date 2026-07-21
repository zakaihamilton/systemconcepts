import { ContentSize } from "@components/Page/Content";
import { useSearch } from "@components/Search";
import { useToolbar } from "@components/Toolbar";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { exportData, importData } from "@util/storage/importExport";
import { StatusBarStore } from "@widgets/StatusBar";
import TableWidget from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/browser/styles");
jest.mock("@components/Search", () => ({ useSearch: jest.fn() }));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/storage/importExport", () => ({
	exportData: jest.fn(),
	importData: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), error: jest.fn() },
}));
jest.mock("@widgets/StatusBar", () => ({
	StatusBarStore: {
		useState: jest.fn().mockReturnValue(0),
	},
}));
jest.mock("@widgets/Message", () => ({ label, Icon }) => (
	<div data-testid="message">{label}</div>
));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<span title={title}>{children}</span>
));
jest.mock("./Row", () => (props) => (
	<tr
		data-testid="table-row"
		data-selected={String(!!props.selected)}
		data-separator={String(!!props.separator)}
		data-classname={props.className || ""}
		onClick={() => props.rowClick?.(props.item)}
	>
		<td>{props.item?.name}</td>
	</tr>
));
jest.mock("./Item", () => (props) => (
	<div
		data-testid="table-item"
		data-index={props.index}
		data-selected={String(!!props.selected)}
		data-separator={String(!!props.separator)}
		onClick={() => props.rowClick?.(props.item)}
	>
		{props.item?.name}
	</div>
));
jest.mock("./Navigator", () => ({ pageIndex, setPageIndex, pageCount }) => (
	<div data-testid="table-navigator">
		<span data-testid="page-index">{pageIndex}</span>
		<span data-testid="page-count">{pageCount}</span>
		<button type="button" onClick={() => setPageIndex(pageIndex + 1)}>
			Next page
		</button>
	</div>
));
jest.mock("./Error", () => ({ error }) => (
	<div data-testid="table-error">{String(error)}</div>
));
jest.mock("./TableColumn", () => ({ item, createSortHandler, orderBy }) => {
	const sortId = typeof item.sortable === "string" ? item.sortable : item.id;
	return (
		<th data-testid="table-column" data-id={item.id}>
			<button type="button" onClick={createSortHandler(sortId)}>
				Sort {item.title}
			</button>
			{orderBy === sortId ? <span data-testid={`sorted-${item.id}`} /> : null}
		</th>
	);
});
jest.mock("./ListColumns", () => ({ columns, onSort, orderBy }) => (
	<div data-testid="list-columns">
		{(columns || []).map((column) => {
			const sortId =
				typeof column.sortable === "string" ? column.sortable : column.id;
			return (
				<button key={column.id} type="button" onClick={onSort(sortId)}>
					List sort {column.title}
				</button>
			);
		})}
		<span data-testid="list-orderby">{orderBy}</span>
	</div>
));

const listScrollTo = jest.fn();
const gridScrollTo = jest.fn();

jest.mock("@components/Virtualized/FixedSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockFixedSizeList(
		{ children: Child, itemCount, itemData, onScroll, innerElementType: Inner },
		ref,
	) {
		React.useImperativeHandle(ref, () => ({ scrollTo: listScrollTo }));
		return (
			<div data-testid="fixed-list">
				{Inner ? <Inner /> : null}
				{Array.from({ length: itemCount }, (_, index) => (
					<Child key={index} index={index} style={{}} data={itemData} />
				))}
				<button
					type="button"
					data-testid="list-scroll"
					onClick={() => onScroll?.({ scrollOffset: 120 })}
				>
					Scroll list
				</button>
			</div>
		);
	});
});

jest.mock("@components/Virtualized/FixedSizeGrid", () => {
	const React = require("react");
	return React.forwardRef(function MockFixedSizeGrid(
		{ children: Child, rowCount, columnCount, itemData, onScroll },
		ref,
	) {
		React.useImperativeHandle(ref, () => ({ scrollTo: gridScrollTo }));
		return (
			<div data-testid="fixed-grid">
				{Array.from({ length: rowCount }, (_, rowIndex) =>
					Array.from({ length: columnCount }, (_, columnIndex) => (
						<Child
							key={`${rowIndex}-${columnIndex}`}
							rowIndex={rowIndex}
							columnIndex={columnIndex}
							style={{ left: 0, top: 0 }}
							data={itemData}
						/>
					)),
				)}
				<button
					type="button"
					data-testid="grid-scroll"
					onClick={() => onScroll?.({ scrollTop: 80 })}
				>
					Scroll grid
				</button>
			</div>
		);
	});
});

function createStore(overrides = {}) {
	const state = {
		viewMode: "table",
		itemsPerPage: 10,
		order: "asc",
		orderBy: "name",
		offset: 0,
		scrollOffset: 0,
		...overrides,
	};
	return {
		state,
		useState: jest.fn((selector) =>
			typeof selector === "function" ? selector(state) : { ...state },
		),
		update: jest.fn((fn) => fn(state)),
	};
}

const columns = [
	{ id: "id", title: "ID", searchable: false },
	{ id: "name", title: "Name", sortable: true },
	{ id: "date", title: "Date", sortable: true, searchable: "date" },
	{ id: "hidden", title: "Hidden", visible: false },
	{
		id: "gridOnly",
		title: "Grid only",
		viewModes: { grid: {} },
	},
	{
		id: "tags",
		title: "Tags",
		searchable: "tagsString",
		sortable: "tagsOrder",
	},
];

const data = [
	{ id: 1, name: "Alpha", date: "2024-01-01", tagsString: "one" },
	{ id: 2, name: "Beta  Item", date: "2024-02-01", tagsString: "two" },
	{ id: 3, name: "Gamma", date: "2024-03-01", tagsString: "three" },
];

function renderTable(props = {}, storeOverrides = {}) {
	const store = createStore(storeOverrides);
	const utils = render(
		<ContentSize.Provider
			value={props.size || { width: 1000, height: 800, emPixels: 16 }}
		>
			<TableWidget
				name="Items"
				columns={columns}
				data={data}
				store={store}
				{...props}
			/>
		</ContentSize.Provider>,
	);
	return { ...utils, store };
}

describe("Table Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			NO_ITEMS: "No items",
			TABLE_VIEW: "Table",
			LIST_VIEW: "List",
			GRID_VIEW: "Grid",
			TREE_VIEW: "Tree",
			TRACKS_VIEW: "Tracks",
			SORT: "Sort",
			ROWS_PER_PAGE: "Rows",
			IMPORT: "Import",
			EXPORT: "Export",
			REFRESH: "Refresh",
		});
		useDeviceType.mockReturnValue("desktop");
		useSearch.mockReturnValue("");
		StatusBarStore.useState.mockReturnValue(0);
	});

	it("renders table mode with rows and navigator", () => {
		renderTable();
		expect(screen.getAllByTestId("table-row")).toHaveLength(3);
		expect(screen.getByTestId("table-navigator")).toBeInTheDocument();
		expect(screen.getAllByTestId("table-column").length).toBeGreaterThan(0);
	});

	it("returns null when size has no height", () => {
		const { container } = render(
			<ContentSize.Provider value={{ width: 1000, height: 0 }}>
				<TableWidget columns={columns} data={data} store={createStore()} />
			</ContentSize.Provider>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders list mode items and list columns", () => {
		renderTable(
			{ viewModes: { list: { className: "list" } } },
			{ viewMode: "list" },
		);
		expect(screen.getByTestId("fixed-list")).toBeInTheDocument();
		expect(screen.getByTestId("list-columns")).toBeInTheDocument();
		expect(screen.getAllByTestId("table-item").length).toBe(3);
	});

	it("renders tree mode with separators and row class names", () => {
		const getSeparator = jest.fn((item, prev) => item.name !== prev.name);
		const rowClassName = jest.fn(() => "row-x");
		const rowClick = jest.fn();
		renderTable(
			{
				viewModes: { tree: { className: "tree" } },
				getSeparator,
				rowClassName,
				rowClick,
				selectedRow: (item) => item.id === 2,
				treeGroup: (items) => items,
			},
			{ viewMode: "tree" },
		);
		expect(screen.getByTestId("fixed-list")).toBeInTheDocument();
		fireEvent.click(screen.getAllByTestId("table-item")[0]);
		expect(rowClick).toHaveBeenCalled();
	});

	it("renders grid mode cells", () => {
		renderTable(
			{
				viewModes: { grid: { className: "grid" } },
				cellWidth: "10em",
				cellHeight: "10em",
				selectedRow: (item) => item.id === 1,
				rowClick: jest.fn(),
				rowClassName: () => "g",
			},
			{ viewMode: "grid" },
		);
		expect(screen.getByTestId("fixed-grid")).toBeInTheDocument();
		expect(screen.getAllByTestId("table-item").length).toBeGreaterThan(0);
	});

	it("returns null for unsupported view modes", () => {
		const { container } = renderTable(
			{ viewModes: { tracks: null } },
			{ viewMode: "tracks" },
		);
		expect(container.querySelector("[data-testid]")).toBeNull();
	});

	it("shows delayed loading and empty messages", async () => {
		jest.useFakeTimers();
		const store = createStore();
		render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					loading
					columns={columns}
					data={[]}
					store={store}
					emptyLabel="Nothing here"
				/>
			</ContentSize.Provider>,
		);
		expect(screen.queryByTestId("message")).not.toBeInTheDocument();
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(screen.getByTestId("message")).toHaveTextContent("Loading...");

		const { rerender } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					loading={false}
					columns={columns}
					data={[]}
					store={store}
					emptyLabel="Nothing here"
				/>
			</ContentSize.Provider>,
		);
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		await waitFor(() => {
			expect(screen.getByText("Nothing here")).toBeInTheDocument();
		});
		rerender(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					loading={false}
					columns={columns}
					data={data}
					store={store}
				/>
			</ContentSize.Provider>,
		);
	});

	it("renders error state", () => {
		renderTable({ error: "boom" });
		expect(screen.getByTestId("table-error")).toHaveTextContent("boom");
	});

	it("hides columns and still renders table body", () => {
		renderTable({ hideColumns: true });
		expect(screen.queryByTestId("table-column")).not.toBeInTheDocument();
		expect(screen.getAllByTestId("table-row")).toHaveLength(3);
	});

	it("filters via search AND/OR and quoted terms", () => {
		useSearch.mockReturnValue('Alpha OR "Beta  Item"');
		renderTable();
		expect(screen.getAllByTestId("table-row")).toHaveLength(2);
	});

	it("filters @doublespace special search", () => {
		useSearch.mockReturnValue("@doublespace");
		renderTable();
		const rows = screen.getAllByTestId("table-row");
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain("Beta");
	});

	it("applies custom filter and mapper", () => {
		renderTable({
			filter: (item) => item.id !== 2,
			mapper: (item) => ({ ...item, name: item.name.toUpperCase() }),
		});
		expect(screen.getAllByTestId("table-row")).toHaveLength(2);
		expect(screen.getByText("ALPHA")).toBeInTheDocument();
	});

	it("sorts via header click and toggles asc/desc", () => {
		const { store, rerender } = renderTable(
			{},
			{ orderBy: "name", order: "desc" },
		);
		fireEvent.click(screen.getByRole("button", { name: "Sort Name" }));
		expect(store.state.order).toBe("asc");
		expect(store.state.orderBy).toBe("name");

		rerender(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget name="Items" columns={columns} data={data} store={store} />
			</ContentSize.Provider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Sort Name" }));
		expect(store.state.order).toBe("desc");
	});

	it("paginates with navigator and itemsPerPage", () => {
		const many = Array.from({ length: 25 }, (_, i) => ({
			id: i + 1,
			name: `Item ${i + 1}`,
			date: "2024-01-01",
			tagsString: "",
		}));
		const { store } = renderTable(
			{ data: many },
			{ itemsPerPage: 10, offset: 0 },
		);
		expect(screen.getAllByTestId("table-row")).toHaveLength(10);
		expect(screen.getByTestId("page-count")).toHaveTextContent("3");
		fireEvent.click(screen.getByRole("button", { name: "Next page" }));
		expect(store.state.offset).toBe(10);
	});

	it("registers toolbar actions for import export refresh sort and view modes", async () => {
		const onImport = jest.fn();
		const onExport = jest.fn().mockResolvedValue({
			data: "custom",
			type: "text/plain",
			name: "custom.txt",
		});
		const refresh = jest.fn();
		const many = Array.from({ length: 12 }, (_, i) => ({
			id: i + 1,
			name: `Item ${i + 1}`,
			date: "2024-01-01",
			tagsString: "",
		}));
		const { store } = renderTable(
			{
				data: many,
				onImport,
				onExport,
				refresh,
				viewModes: { table: null, list: {}, grid: {} },
				showSort: true,
			},
			{ viewMode: "list" },
		);

		expect(useToolbar).toHaveBeenCalled();
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const byId = Object.fromEntries(
			toolbar.items.map((item) => [item.id, item]),
		);

		importData.mockResolvedValueOnce({ body: '{"ok":true}' });
		await byId.import.onClick();
		expect(onImport).toHaveBeenCalledWith({ ok: true });

		importData.mockRejectedValueOnce(new Error("cancel"));
		await byId.import.onClick();

		importData.mockResolvedValueOnce({ body: "not-json" });
		await byId.import.onClick();

		await byId.export.onClick();
		expect(exportData).toHaveBeenCalledWith(
			"custom",
			"custom.txt",
			"text/plain",
		);

		byId.refresh.onClick();
		expect(refresh).toHaveBeenCalled();

		expect(byId.sort).toBeTruthy();
		byId.sort.items[0].onClick();

		byId.viewGroup.element.props.children[0].props.children.props.onClick();
		expect(store.state.viewMode).toBe("table");
	});

	it("exports default JSON payload when onExport is absent", async () => {
		renderTable({
			onImport: jest.fn(),
			viewModes: { table: null },
		});
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const exportItem = toolbar.items.find((item) => item.id === "export");
		await exportItem.onClick();
		expect(exportData).toHaveBeenCalledWith(
			expect.stringContaining("Items"),
			"Items",
			"application/json",
		);
	});

	it("exports raw result from onExport when not an object with data", async () => {
		renderTable({
			onExport: jest.fn().mockResolvedValue("plain-body"),
		});
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const exportItem = toolbar.items.find((item) => item.id === "export");
		await exportItem.onClick();
		expect(exportData).toHaveBeenCalledWith(
			"plain-body",
			"Items",
			"application/json",
		);
	});

	it("shows itemsPerPage menu in table mode for large data", () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			id: i + 1,
			name: `Item ${i + 1}`,
			date: "2024-01-01",
			tagsString: "",
		}));
		const { store } = renderTable({ data: many }, { viewMode: "table" });
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const rows = toolbar.items.find((item) => item.id === "itemsPerPage");
		expect(rows).toBeTruthy();
		rows.items.find((item) => item.id === 25).onClick();
		expect(store.state.itemsPerPage).toBe(25);
	});

	it("does not register desktop view group on mobile", () => {
		useDeviceType.mockReturnValue("phone");
		renderTable({
			viewModes: { table: null, list: {} },
		});
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		expect(toolbar.items.find((item) => item.id === "viewGroup")).toBeFalsy();
	});

	it("resets invalid orderBy to default sort", () => {
		const { store } = renderTable({}, { orderBy: "missing" });
		expect(store.update).toHaveBeenCalled();
		expect(store.state.orderBy).toBe("id");
	});

	it("restores and resets scroll offsets", async () => {
		jest.useFakeTimers();
		const store = createStore({
			viewMode: "list",
			scrollOffset: 50,
		});
		const { rerender } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ list: {} }}
					loading={false}
					resetScrollDeps={["initial"]}
				/>
			</ContentSize.Provider>,
		);
		act(() => {
			jest.advanceTimersByTime(50);
		});
		expect(listScrollTo).toHaveBeenCalledWith(50);

		rerender(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ list: {} }}
					loading={false}
					resetScrollDeps={["filter-a"]}
				/>
			</ContentSize.Provider>,
		);
		expect(store.state.scrollOffset).toBe(0);

		fireEvent.click(screen.getByTestId("list-scroll"));
		act(() => {
			jest.advanceTimersByTime(300);
		});
		expect(store.state.scrollOffset).toBe(120);
	});

	it("saves grid scroll position", () => {
		jest.useFakeTimers();
		renderTable({ viewModes: { grid: {} } }, { viewMode: "grid" });
		fireEvent.click(screen.getByTestId("grid-scroll"));
		act(() => {
			jest.advanceTimersByTime(300);
		});
		expect(useToolbar).toHaveBeenCalled();
	});

	it("applies status bar height when status bar is active", () => {
		StatusBarStore.useState.mockReturnValue(1);
		renderTable({
			statusBar: <div data-testid="status">bar</div>,
			statusBarHeight: "2em",
		});
		expect(screen.getByTestId("status")).toBeInTheDocument();
	});

	it("uses px sizes and tree grouping", () => {
		const treeGroup = jest.fn((items) =>
			items.map((item) => ({
				...item,
				mapped: { ...item.mapped, name: `T-${item.mapped.name}` },
			})),
		);
		renderTable(
			{
				itemHeight: "40px",
				cellWidth: "100px",
				cellHeight: "100px",
				viewModes: { tree: {} },
				treeGroup,
				expandedTreeGroups: ["x"],
			},
			{ viewMode: "tree" },
		);
		expect(treeGroup).toHaveBeenCalled();
		expect(screen.getByText("T-Alpha")).toBeInTheDocument();
	});

	it("resets search offset via useSearch callback", () => {
		let searchCb;
		useSearch.mockImplementation((name, cb) => {
			searchCb = cb;
			return "";
		});
		const { store } = renderTable({}, { offset: 40 });
		searchCb();
		expect(store.state.offset).toBe(0);
	});

	it("renders separators in table mode", () => {
		const getSeparator = jest.fn(() => true);
		renderTable({ getSeparator });
		expect(
			screen
				.getAllByTestId("table-row")
				.some((row) => row.getAttribute("data-separator") === "true"),
		).toBe(true);
	});

	it("handles selected rows in table mode", () => {
		const rowClick = jest.fn();
		renderTable({
			selectedRow: (item) => item.id === 1,
			rowClick,
			rowClassName: () => "selected-row",
		});
		const rows = screen.getAllByTestId("table-row");
		const selected = rows.find(
			(row) => row.getAttribute("data-selected") === "true",
		);
		expect(selected).toBeTruthy();
		fireEvent.click(selected);
		expect(rowClick).toHaveBeenCalled();
	});

	it("hides list header row when hideColumns is false and index is 0", () => {
		renderTable(
			{ viewModes: { list: {} }, hideColumns: false },
			{ viewMode: "list" },
		);
		// index 0 is reserved for header and returns null from TableListRow
		expect(screen.getAllByTestId("table-item").length).toBe(3);
	});

	it("handles empty columns and data defaults", () => {
		render(
			<ContentSize.Provider value={{ width: 1000, height: 800 }}>
				<TableWidget store={createStore()} />
			</ContentSize.Provider>,
		);
		expect(screen.queryByTestId("table-row")).not.toBeInTheDocument();
	});

	it("filters columns by visible false and viewModes", () => {
		renderTable({
			columns: [
				{ id: "name", title: "Name", sortable: true },
				{ id: "secret", title: "Secret", visible: false },
				{ id: "gridOnly", title: "Grid only", viewModes: { grid: {} } },
			],
		});
		const ids = screen
			.getAllByTestId("table-column")
			.map((el) => el.getAttribute("data-id"));
		expect(ids).toContain("name");
		expect(ids).not.toContain("secret");
		expect(ids).not.toContain("gridOnly");
	});

	it("restores grid scroll offset after load", () => {
		jest.useFakeTimers();
		const store = createStore({
			viewMode: "grid",
			scrollOffset: 40,
		});
		render(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ grid: {} }}
					loading={false}
				/>
			</ContentSize.Provider>,
		);
		act(() => {
			jest.advanceTimersByTime(50);
		});
		expect(gridScrollTo).toHaveBeenCalledWith({ scrollTop: 40 });
	});

	it("renders list items when hideColumns is true including index 0", () => {
		renderTable(
			{ viewModes: { list: {} }, hideColumns: true },
			{ viewMode: "list" },
		);
		expect(screen.getAllByTestId("table-item").length).toBe(3);
	});

	it("uses searchable string keys for filtering", () => {
		useSearch.mockReturnValue("one");
		renderTable();
		expect(screen.getAllByTestId("table-row")).toHaveLength(1);
	});

	it("filters out falsy columns and uses sortable string search keys", () => {
		useSearch.mockReturnValue("tagged");
		renderTable({
			columns: [
				{ id: "name", title: "Name", sortable: true },
				{
					id: "tags",
					title: "Tags",
					sortable: "tagsOrder",
					searchable: false,
				},
				{ id: "hidden", title: "Hidden", visible: false },
			],
			data: [
				{ id: 1, name: "tagged", tagsOrder: "tagged" },
				{ id: 2, name: "other", tagsOrder: "nope" },
			],
		});
		expect(screen.getAllByTestId("table-row")).toHaveLength(1);
		expect(
			screen
				.getAllByTestId("table-column")
				.map((el) => el.getAttribute("data-id")),
		).not.toContain("hidden");
	});

	it("resets grid scroll when resetScrollDeps change", () => {
		const store = createStore({ viewMode: "grid", scrollOffset: 40 });
		const { rerender } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ grid: {} }}
					loading={false}
					resetScrollDeps={["a"]}
				/>
			</ContentSize.Provider>,
		);
		rerender(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ grid: {} }}
					loading={false}
					resetScrollDeps={["b"]}
				/>
			</ContentSize.Provider>,
		);
		expect(gridScrollTo).toHaveBeenCalledWith({ scrollTop: 0 });
		expect(store.state.scrollOffset).toBe(0);
	});

	it("omits mobile export toolbar and sort when showSort is false", () => {
		useDeviceType.mockReturnValue("phone");
		renderTable(
			{
				data: Array.from({ length: 12 }, (_, i) => ({
					id: i + 1,
					name: `Item ${i + 1}`,
					date: "2024-01-01",
					tagsString: "",
				})),
				viewModes: { table: null, list: {} },
				showSort: false,
				onImport: jest.fn(),
			},
			{ viewMode: "list" },
		);
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const ids = toolbar.items.map((item) => item.id);
		expect(ids).not.toContain("export");
		expect(ids).not.toContain("sort");
	});

	it("skips import when importData returns a falsy error", async () => {
		const onImport = jest.fn();
		renderTable({ onImport });
		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const importItem = toolbar.items.find((item) => item.id === "import");
		importData.mockRejectedValueOnce(null);
		await importItem.onClick();
		expect(onImport).not.toHaveBeenCalled();
	});

	it("searches via sortable string keys when searchable is undefined", () => {
		useSearch.mockReturnValue("codesearch");
		renderTable({
			columns: [
				{ id: "name", title: "Name" },
				{ id: "code", title: "Code", sortable: "codeSort" },
			],
			data: [
				{ id: 1, name: "Alpha", codeSort: "codesearch" },
				{ id: 2, name: "Beta", codeSort: "other" },
			],
		});
		expect(screen.getAllByTestId("table-row")).toHaveLength(1);
	});

	it("uses built-in defaults when store pagination state is missing", () => {
		const store = {
			useState: jest.fn((selector) =>
				typeof selector === "function" ? selector({}) : {},
			),
			update: jest.fn((fn) => fn({})),
		};
		render(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget name="Items" columns={columns} data={data} store={store} />
			</ContentSize.Provider>,
		);
		expect(screen.getAllByTestId("table-row")).toHaveLength(3);
	});

	it("shows phone sort and rows-per-page menus in list and table modes", () => {
		useDeviceType.mockReturnValue("phone");
		const longData = Array.from({ length: 12 }, (_, i) => ({
			id: i + 1,
			name: `Item ${i + 1}`,
			date: "2024-01-01",
			tagsString: "",
		}));
		renderTable(
			{
				data: longData,
				viewModes: { table: {}, list: {} },
				showSort: true,
			},
			{ viewMode: "list" },
		);
		let toolbar = useToolbar.mock.calls.at(-1)[0];
		expect(toolbar.items.map((item) => item.id)).toContain("sort");

		renderTable(
			{
				data: longData,
				viewModes: { table: {}, list: {} },
				showSort: true,
			},
			{ viewMode: "table" },
		);
		toolbar = useToolbar.mock.calls.at(-1)[0];
		expect(toolbar.items.map((item) => item.id)).toContain("itemsPerPage");
	});

	it("restores scroll on grid when loading completes", () => {
		jest.useFakeTimers();
		const store = createStore({ viewMode: "grid", scrollOffset: 40 });
		const { rerender } = render(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ grid: {} }}
					loading={true}
				/>
			</ContentSize.Provider>,
		);
		rerender(
			<ContentSize.Provider value={{ width: 1000, height: 800, emPixels: 16 }}>
				<TableWidget
					columns={columns}
					data={data}
					store={store}
					viewModes={{ grid: {} }}
					loading={false}
				/>
			</ContentSize.Provider>,
		);
		act(() => {
			jest.advanceTimersByTime(50);
		});
		expect(gridScrollTo).toHaveBeenCalledWith({ scrollTop: 40 });
	});
});
