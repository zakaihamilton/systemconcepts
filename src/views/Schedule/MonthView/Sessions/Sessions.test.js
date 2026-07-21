import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { useDateFormatter } from "@util/data/locale";
import Sessions from "./Sessions.js";

jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/browser/touch", () => ({
	useSwipe: jest.fn(),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@widgets/Dialog", () => ({ title, onClose, children, ...rest }) => (
	<div data-testid="dialog" data-title={title} data-swipe={!!rest.onSwipeLeft}>
		<button type="button" data-testid="close" onClick={onClose}>
			close
		</button>
		{children}
	</div>
));
jest.mock("./Session", () => (props) => (
	<div
		data-testid={`session-${props.name}`}
		data-playing={String(!!props.isPlaying)}
		data-group={props.group}
	/>
));

describe("MonthView Sessions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		useSwipe.mockReturnValue({
			onSwipeLeft: jest.fn(),
			onSwipeRight: jest.fn(),
		});
		useDateFormatter.mockReturnValue({
			format: () => "Monday, June 10, 2024",
		});
	});

	it("returns null when closed", () => {
		const { container } = render(
			<Sessions
				open={false}
				onClose={jest.fn()}
				date={new Date()}
				items={[]}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});

	it("sorts items and marks playing session", () => {
		const onClose = jest.fn();
		const onSwipeLeft = jest.fn();
		const onSwipeRight = jest.fn();
		useSwipe.mockReturnValue({ onSwipeLeft, onSwipeRight });

		render(
			<Sessions
				open
				onClose={onClose}
				date={new Date("2024-06-10")}
				direction="rtl"
				onSwipeLeft={onSwipeLeft}
				onSwipeRight={onSwipeRight}
				playingSession={{
					name: "B",
					group: "bravo",
					date: "2024-06-10",
				}}
				items={[
					{
						id: "2",
						name: "B",
						description: "Bravo",
						backgroundColor: "#00f",
						type: "audio",
						typeOrder: 1,
						date: "2024-06-10",
						group: "bravo",
					},
					{
						id: "1",
						name: "A",
						description: "Alpha",
						backgroundColor: "#f00",
						type: "audio",
						typeOrder: 2,
						date: "2024-06-10",
						group: "alpha",
					},
				]}
			/>,
		);

		expect(screen.getByTestId("dialog")).toHaveAttribute(
			"data-title",
			"Monday, June 10, 2024",
		);
		expect(screen.getByTestId("session-A")).toHaveAttribute(
			"data-group",
			"alpha",
		);
		expect(screen.getByTestId("session-B")).toHaveAttribute(
			"data-playing",
			"true",
		);
		fireEvent.click(screen.getByTestId("close"));
		expect(onClose).toHaveBeenCalled();
	});

	it("applies mobile list class on phone", () => {
		useDeviceType.mockReturnValue("phone");
		render(
			<Sessions
				open
				onClose={jest.fn()}
				date={new Date()}
				items={[
					{
						id: "1",
						name: "Solo",
						date: "2024-01-01",
						typeOrder: 0,
					},
				]}
			/>,
		);
		expect(screen.getByTestId("session-Solo")).toBeInTheDocument();
	});

	it("passes swipe handlers through to the dialog on mobile", () => {
		useDeviceType.mockReturnValue("phone");
		const onSwipeLeft = jest.fn();
		const onSwipeRight = jest.fn();
		useSwipe.mockReturnValue({ onSwipeLeft, onSwipeRight });

		render(
			<Sessions
				open
				onClose={jest.fn()}
				date={new Date()}
				onSwipeLeft={onSwipeLeft}
				onSwipeRight={onSwipeRight}
				items={[
					{
						id: "1",
						name: "Swipe",
						date: "2024-01-01",
						typeOrder: 0,
					},
				]}
			/>,
		);

		expect(screen.getByTestId("dialog")).toHaveAttribute("data-swipe", "true");
	});

	it("sorts sessions with the same group by typeOrder", () => {
		render(
			<Sessions
				open
				onClose={jest.fn()}
				date={new Date()}
				items={[
					{
						id: "2",
						name: "Second",
						description: "Group",
						typeOrder: 2,
						date: "2024-01-01",
					},
					{
						id: "1",
						name: "First",
						description: "Group",
						typeOrder: 1,
						date: "2024-01-01",
					},
				]}
			/>,
		);

		const sessions = screen.getAllByTestId(/session-/);
		expect(sessions[0]).toHaveAttribute("data-testid", "session-First");
		expect(sessions[1]).toHaveAttribute("data-testid", "session-Second");
	});
});
