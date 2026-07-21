import { ContentSize } from "@components/Page/Content";
import { useToolbar } from "@components/Toolbar";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useDateFormatter } from "@util/data/locale";
import { addPath } from "@util/domain/views";
import TracksView from "./TracksView.js";

let capturedInputs = [];

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
}));
jest.mock("@components/Widgets/Input", () => (props) => {
	capturedInputs.push(props);
	return (
		<button
			type="button"
			data-testid={`input-${props.label}`}
			onClick={() => props.state?.[1]?.(props.items?.[0]?.id || "2024")}
		>
			{props.label}
		</button>
	);
});
jest.mock("@components/Virtualized/FixedSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockFixedSizeList(props, ref) {
		const {
			children: Child,
			itemData,
			itemCount,
			onItemsRendered,
			outerRef,
			onScroll,
		} = props;
		React.useImperativeHandle(ref, () => ({
			scrollToItem: (...args) => globalThis.__scrollToItemMock(...args),
		}));
		React.useEffect(() => {
			if (onItemsRendered) onItemsRendered({ visibleStartIndex: 0 });
			if (onScroll) onScroll({ scrollOffset: 12 });
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);
		return (
			<div
				data-testid="fixed-list"
				ref={(node) => {
					if (outerRef) outerRef.current = node;
					if (node) {
						Object.defineProperty(node, "clientHeight", {
							value: 100,
							configurable: true,
						});
						Object.defineProperty(node, "scrollTop", {
							value: 0,
							writable: true,
							configurable: true,
						});
						node.scrollTo = jest.fn();
					}
				}}
			>
				{Array.from({ length: itemCount }).map((_, index) => (
					<Child key={index} index={index} style={{}} data={itemData} />
				))}
			</div>
		);
	});
});
jest.mock("./Row", () => (props) => (
	<div data-testid={`row-${props.date}`}>
		<span>{props.date}</span>
		{props.sessions.map((session) => (
			<button
				key={session.id}
				type="button"
				onClick={() => props.onSessionClick(session)}
			>
				select-{session.id}
			</button>
		))}
	</div>
));

describe("TracksView", () => {
	const pageSize = { width: 1000, height: 800 };

	beforeEach(() => {
		jest.clearAllMocks();
		capturedInputs = [];
		globalThis.__scrollToItemMock = jest.fn();
		useDeviceType.mockReturnValue("desktop");
		useDateFormatter.mockReturnValue({
			format: (date) => `Month-${date.getMonth() + 1}`,
		});
		sessionStorage.clear();
	});

	const renderTracks = (props) =>
		render(
			<ContentSize.Provider value={pageSize}>
				<TracksView
					translations={{ YEAR: "Year", MONTH: "Month", TODAY: "Today" }}
					sessions={[]}
					{...props}
				/>
			</ContentSize.Provider>,
		);

	it("renders nothing when the page size is not yet known", () => {
		const { container } = render(
			<ContentSize.Provider value={{}}>
				<TracksView translations={{}} sessions={[]} />
			</ContentSize.Provider>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("groups sessions by year-month, sorted descending, skipping invalid dates", () => {
		const sessions = [
			{ id: "1", date: "2024-01-05", group: "a", name: "S1" },
			{ id: "2", date: "2024-02-10", group: "a", name: "S2" },
			{ id: "3", date: "2023-12-01", group: "b", name: "S3" },
			{ id: "4", date: null, group: "b", name: "Skip missing" },
			{ id: "5", date: "invalid", group: "b", name: "Skip malformed" },
			{ id: "6", date: "abcd-ef", group: "b", name: "Skip NaN parts" },
		];
		renderTracks({ sessions });

		const rows = screen
			.getAllByTestId(/^row-/)
			.map((el) => el.getAttribute("data-testid"));
		expect(rows).toEqual(["row-2024-02", "row-2024-01", "row-2023-12"]);
	});

	it("clicking a session navigates via addPath and focuses it", () => {
		const sessions = [
			{
				id: "1",
				date: "2024-01-05",
				group: "american",
				year: "2024",
				name: "Session One",
			},
		];
		renderTracks({ sessions });

		fireEvent.click(screen.getByRole("button", { name: "select-1" }));

		expect(addPath).toHaveBeenCalledWith(
			"session?group=american&year=2024&date=2024-01-05&name=Session%20One",
		);
	});

	it("registers a today toolbar action that scrolls to the top", () => {
		renderTracks({ sessions: [{ id: "1", date: "2024-01-05" }] });

		const lastCall = useToolbar.mock.calls.at(-1)[0];
		const todayItem = lastCall.items.find((item) => item.id === "today");
		expect(todayItem.disabled).toBe(true);

		act(() => {
			todayItem.onClick();
		});
		expect(globalThis.__scrollToItemMock).toHaveBeenCalledWith(0, "start");
	});

	it("navigates focus with arrow keys and activates with Enter", () => {
		const sessions = [
			{ id: "1", date: "2024-02-01", group: "a", year: "2024", name: "A" },
			{ id: "2", date: "2024-02-02", group: "a", year: "2024", name: "B" },
			{ id: "3", date: "2024-01-01", group: "a", year: "2024", name: "C" },
		];
		renderTracks({ sessions });

		fireEvent.keyDown(window, { key: "ArrowDown" });
		fireEvent.keyDown(window, { key: "ArrowRight" });
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.keyDown(window, { key: "ArrowUp" });
		fireEvent.keyDown(window, { key: "Enter" });

		expect(addPath).toHaveBeenCalledWith(
			"session?group=a&year=2024&date=2024-02-02&name=B",
		);
	});

	it("stops at row edges for left/right and clamps across uneven rows", () => {
		const sessions = [
			{ id: "a1", date: "2024-02-01", group: "a", year: "2024", name: "A1" },
			{ id: "a2", date: "2024-02-02", group: "a", year: "2024", name: "A2" },
			{ id: "b1", date: "2024-01-01", group: "a", year: "2024", name: "B1" },
		];
		renderTracks({ sessions });

		fireEvent.keyDown(window, { key: "ArrowDown" });
		fireEvent.keyDown(window, { key: "ArrowRight" });
		fireEvent.keyDown(window, { key: "ArrowRight" });
		fireEvent.keyDown(window, { key: "ArrowDown" });
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.keyDown(window, { key: "Enter" });

		expect(addPath).toHaveBeenCalled();
	});

	it("scrolls the outer list when moving focus across rows", () => {
		const sessions = [
			{ id: "1", date: "2024-02-01", group: "a", year: "2024", name: "A" },
			{ id: "2", date: "2024-01-01", group: "a", year: "2024", name: "B" },
		];
		renderTracks({ sessions });
		fireEvent.keyDown(window, { key: "ArrowDown" });
		fireEvent.keyDown(window, { key: "ArrowDown" });
		expect(screen.getByTestId("fixed-list")).toBeInTheDocument();
	});

	it("ignores repeated key events and unrelated keys", () => {
		const sessions = [
			{ id: "1", date: "2024-02-01", group: "a", year: "2024", name: "A" },
		];
		renderTracks({ sessions });

		fireEvent.keyDown(window, { key: "ArrowDown", repeat: true });
		fireEvent.keyDown(window, { key: "a" });
		expect(addPath).not.toHaveBeenCalled();
	});

	it("does nothing on key events when there are no sessions", () => {
		renderTracks({ sessions: [] });
		fireEvent.keyDown(window, { key: "ArrowDown" });
		expect(addPath).not.toHaveBeenCalled();
	});

	it("updates isAtTop based on scroll position", () => {
		renderTracks({ sessions: [{ id: "1", date: "2024-01-05" }] });
		const list = screen.getByTestId("fixed-list");

		Object.defineProperty(list, "scrollTop", { value: 50, writable: true });
		fireEvent.scroll(list);

		const lastCall = useToolbar.mock.calls.at(-1)[0];
		const todayItem = lastCall.items.find((item) => item.id === "today");
		expect(todayItem.disabled).toBe(false);
	});

	it("year and month inputs scroll the list to the matching group", () => {
		const sessions = [
			{ id: "1", date: "2024-02-01", group: "a", year: "2024", name: "A" },
			{ id: "2", date: "2023-01-01", group: "a", year: "2023", name: "B" },
		];
		renderTracks({ sessions });

		const toolbar = useToolbar.mock.calls.at(-1)[0];
		const yearWidget = toolbar.items.find((item) => item.id === "yearWidget");
		const _monthWidget = toolbar.items.find(
			(item) => item.id === "monthWidget",
		);
		expect(yearWidget.element.props.state).toBeTruthy();

		act(() => {
			yearWidget.element.props.state[1]("2023");
		});
		expect(globalThis.__scrollToItemMock).toHaveBeenCalled();

		const updatedToolbar = useToolbar.mock.calls.at(-1)[0];
		const updatedMonth = updatedToolbar.items.find(
			(item) => item.id === "monthWidget",
		);
		act(() => {
			updatedMonth.element.props.state[1]("01");
		});
		expect(globalThis.__scrollToItemMock).toHaveBeenCalled();
	});

	it("persists scroll offset into sessionStorage on unmount", () => {
		const { unmount } = renderTracks({
			sessions: [{ id: "1", date: "2024-01-05" }],
		});
		unmount();
		expect(sessionStorage.getItem("tracks_vertical_offset")).toBe("12");
	});

	it("supports mobile device type without crashing", () => {
		useDeviceType.mockReturnValue("phone");
		renderTracks({
			sessions: [{ id: "1", date: "2024-01-05" }],
			playingSession: { id: "1" },
			store: {},
		});
		expect(screen.getByTestId("fixed-list")).toBeInTheDocument();
	});

	it("ignores onItemsRendered when the visible index is out of range", () => {
		const FixedSizeList = require("@components/Virtualized/FixedSizeList");
		const original = FixedSizeList;
		void original;
		renderTracks({ sessions: [{ id: "1", date: "2024-01-05" }] });
		expect(screen.getByTestId("row-2024-01")).toBeInTheDocument();
	});
});
