import { fireEvent, render, screen } from "@testing-library/react";
import { useDateFormatter } from "@util/data/locale";
import { GroupsStore } from "@util/domain/groups";
import { ScheduleStore } from "@views/Schedule/Schedule";
import TrackRow from "./Row.js";

jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@util/domain/groups", () => ({
	GroupsStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@views/Schedule/Schedule", () => ({
	ScheduleStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-title={title}>{children}</div>
));
jest.mock("@ui/IconButton", () => ({ children, onClick, className }) => (
	<button type="button" className={className} onClick={onClick}>
		{children}
	</button>
));
jest.mock("@ui/Typography", () => ({ children, onClick, className }) => (
	<button type="button" className={className} onClick={onClick}>
		{children}
	</button>
));
jest.mock("../Card", () => (props) => (
	<button
		type="button"
		data-testid={`card-${props.session.id}`}
		data-active={props.isActive ? "true" : "false"}
		data-playing={props.isPlaying ? "true" : "false"}
		onClick={() => props.onSessionClick(props.session)}
	>
		{props.session.name}
	</button>
));
jest.mock("@components/Virtualized/FixedSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockFixedSizeList(props, ref) {
		const {
			children: Child,
			itemData,
			itemCount,
			outerRef,
			onScroll,
			innerElementType: Inner,
		} = props;
		React.useImperativeHandle(ref, () => ({}));
		if (outerRef) {
			outerRef.current = globalThis.__trackListScroll;
		}
		const content = Array.from({ length: itemCount }).map((_, index) => (
			<Child
				key={index}
				index={index}
				style={{ left: `${index * 350}px` }}
				data={itemData}
			/>
		));
		return (
			<div data-testid="row-list">
				{Inner ? <Inner style={{ width: "1000px" }}>{content}</Inner> : content}
				<button
					type="button"
					data-testid="simulate-scroll"
					onClick={() => onScroll?.({ scrollOffset: 42 })}
				>
					scroll
				</button>
			</div>
		);
	});
});

describe("TrackRow", () => {
	const sessions = [
		{
			id: "1",
			name: "One",
			group: "alpha",
			date: "2024-01-05",
		},
		{
			id: "2",
			name: "Two",
			group: "beta",
			date: "2024-01-06",
		},
		{
			id: "3",
			name: "Three",
			group: "alpha",
			date: "2024-01-07",
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		sessionStorage.clear();
		globalThis.__trackListScroll = {
			scrollLeft: 0,
			clientWidth: 200,
			scrollTo: jest.fn(),
		};
		useDateFormatter.mockReturnValue({
			format: () => "January 2024",
		});
		GroupsStore.useState.mockReturnValue([
			{ name: "alpha", color: "#f00" },
			{ name: "beta", color: "#0f0" },
		]);
		ScheduleStore.useState.mockReturnValue(true);
		ScheduleStore.update.mockImplementation((fn) => {
			const state = { showBadges: true };
			fn(state);
		});
	});

	it("renders formatted date and session cards", () => {
		const onSessionClick = jest.fn();
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				onSessionClick={onSessionClick}
				focusedSessionId="2"
				playingSession={{
					name: "Two",
					group: "beta",
					date: "2024-01-06",
				}}
				translations={{
					HIDE_GROUP_COUNTERS: "Hide",
					SHOW_GROUP_COUNTERS: "Show",
				}}
			/>,
		);

		expect(screen.getByText("January 2024")).toBeInTheDocument();
		expect(screen.getByTestId("card-1")).toBeInTheDocument();
		expect(screen.getByTestId("card-2")).toHaveAttribute("data-active", "true");
		expect(screen.getByTestId("card-2")).toHaveAttribute(
			"data-playing",
			"true",
		);

		fireEvent.click(screen.getByTestId("card-1"));
		expect(onSessionClick).toHaveBeenCalledWith(sessions[0]);
	});

	it("shows group badges and toggles them", () => {
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				translations={{
					HIDE_GROUP_COUNTERS: "Hide",
					SHOW_GROUP_COUNTERS: "Show",
				}}
			/>,
		);

		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "" }));
		expect(ScheduleStore.update).toHaveBeenCalled();
	});

	it("hides badges when showBadges is false", () => {
		ScheduleStore.useState.mockReturnValue(false);
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				translations={{
					HIDE_GROUP_COUNTERS: "Hide",
					SHOW_GROUP_COUNTERS: "Show",
				}}
			/>,
		);
		expect(screen.queryByText("2")).not.toBeInTheDocument();
	});

	it("navigates to month view on header click", () => {
		const store = {
			update: jest.fn((fn) => {
				const state = { viewMode: "tracks", lastViewMode: null };
				fn(state);
				store._state = state;
			}),
		};
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				store={store}
				translations={{}}
			/>,
		);
		fireEvent.click(screen.getByText("January 2024"));
		expect(store._state.viewMode).toBe("month");
		expect(store._state.lastViewMode).toBe("tracks");
		expect(store._state.date.getFullYear()).toBe(2024);
		expect(store._state.date.getMonth()).toBe(0);
	});

	it("does not navigate when store is missing", () => {
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				translations={{}}
			/>,
		);
		fireEvent.click(screen.getByText("January 2024"));
	});

	it("skips list when width is zero and shows overflow indicator", () => {
		const { rerender } = render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={0}
				translations={{}}
			/>,
		);
		expect(screen.queryByTestId("row-list")).not.toBeInTheDocument();

		rerender(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={100}
				itemSize={350}
				translations={{}}
			/>,
		);
		expect(screen.getByTestId("row-list")).toBeInTheDocument();
	});

	it("persists scroll offset in sessionStorage", () => {
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				translations={{}}
			/>,
		);
		fireEvent.click(screen.getByTestId("simulate-scroll"));
		expect(sessionStorage.getItem("track_scroll_2024-01")).toBe("42");
	});

	it("scrolls focused session into view when offscreen left or right", () => {
		const { rerender } = render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={400}
				itemSize={350}
				focusedSessionId={null}
				translations={{}}
			/>,
		);

		rerender(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={400}
				itemSize={350}
				focusedSessionId="3"
				translations={{}}
			/>,
		);
		expect(globalThis.__trackListScroll.scrollTo).toHaveBeenCalledWith(
			expect.objectContaining({ behavior: "smooth" }),
		);

		globalThis.__trackListScroll.scrollLeft = 900;
		globalThis.__trackListScroll.scrollTo.mockClear();
		rerender(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={400}
				itemSize={350}
				focusedSessionId="1"
				translations={{}}
			/>,
		);
		expect(globalThis.__trackListScroll.scrollTo).toHaveBeenCalledWith(
			expect.objectContaining({ left: 0, behavior: "smooth" }),
		);
	});

	it("uses default width and translations when omitted", () => {
		render(<TrackRow date="2024-01" sessions={sessions} />);
		expect(screen.getByText("January 2024")).toBeInTheDocument();
		expect(screen.queryByTestId("row-list")).not.toBeInTheDocument();
	});

	it("ignores focus scroll when session id is unknown", () => {
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={400}
				focusedSessionId="missing"
				translations={{}}
			/>,
		);
		expect(screen.getByTestId("row-list")).toBeInTheDocument();
	});

	it("uses default badge color when group metadata is missing", () => {
		GroupsStore.useState.mockReturnValue([]);
		render(
			<TrackRow
				date="2024-01"
				sessions={sessions}
				width={800}
				translations={{
					HIDE_GROUP_COUNTERS: "Hide",
					SHOW_GROUP_COUNTERS: "Show",
				}}
			/>,
		);
		expect(screen.getByText("2")).toBeInTheDocument();
	});
});
