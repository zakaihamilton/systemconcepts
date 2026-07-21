import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { getDateString } from "@util/data/date";
import Day from "./Day.js";

jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/data/date", () => ({
	getDateString: jest.fn(),
}));
jest.mock("../Session", () => (props) => (
	<div
		data-testid={`session-${props.name}`}
		data-playing={String(!!props.isPlaying)}
		data-show-group={String(props.showGroup)}
	/>
));

describe("WeekView Day", () => {
	const date = new Date("2024-06-10T12:00:00");

	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		getDateString.mockReturnValue("2024-06-10");
	});

	it("renders grouped sessions sorted by group and typeOrder", () => {
		render(
			<Day
				column={1}
				row={1}
				count={7}
				date={date}
				collapsedGroups={[]}
				onToggleGroup={jest.fn()}
				sessions={[
					{
						name: "Beta",
						group: "bravo",
						date: "2024-06-10",
						typeOrder: 2,
						color: "#00f",
						key: "b",
					},
					{
						name: "Alpha",
						group: "alpha",
						date: "2024-06-10",
						typeOrder: 1,
						color: "#f00",
						key: "a",
					},
					{
						name: "OtherDay",
						group: "alpha",
						date: "2024-06-11",
						typeOrder: 0,
						key: "o",
					},
				]}
			/>,
		);

		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("Bravo")).toBeInTheDocument();
		expect(screen.getByTestId("session-Alpha")).toHaveAttribute(
			"data-show-group",
			"false",
		);
		expect(screen.queryByTestId("session-OtherDay")).not.toBeInTheDocument();
	});

	it("toggles group collapse and marks playing session", () => {
		const onToggleGroup = jest.fn();
		render(
			<Day
				column={7}
				row={1}
				count={7}
				date={date}
				collapsedGroups={["alpha"]}
				onToggleGroup={onToggleGroup}
				playingSession={{
					name: "Alpha",
					group: "alpha",
					date: "2024-06-10",
				}}
				sessions={[
					{
						name: "Alpha",
						group: "alpha",
						date: "2024-06-10",
						color: "#f00",
					},
					{ name: "NoGroup", group: "", date: "2024-06-10" },
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { expanded: false }));
		expect(onToggleGroup).toHaveBeenCalledWith("alpha");
		expect(screen.getByTestId("session-Alpha")).toHaveAttribute(
			"data-playing",
			"true",
		);
	});

	it("applies mobile styles when phone", () => {
		useDeviceType.mockReturnValue("phone");
		const { container } = render(
			<Day
				column={1}
				row={1}
				count={7}
				date={date}
				sessions={[]}
				collapsedGroups={[]}
				onToggleGroup={jest.fn()}
			/>,
		);
		expect(container.firstChild).toBeTruthy();
	});

	it("handles null sessions", () => {
		render(
			<Day
				column={1}
				row={1}
				count={7}
				date={date}
				sessions={null}
				collapsedGroups={null}
				onToggleGroup={jest.fn()}
			/>,
		);
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});
