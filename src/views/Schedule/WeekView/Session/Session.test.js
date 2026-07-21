import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSessionTextColor } from "@util/data/colors";
import { addPath, toPath } from "@util/domain/views";
import Session from "./Session.js";

jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/data/colors", () => ({
	useSessionTextColor: jest.fn(() => "#000"),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((p) => p),
}));
jest.mock("@ui/Link", () => ({ children, onClick, href, className }) => (
	<a href={href} className={className} onClick={onClick}>
		{children}
	</a>
));
jest.mock("@widgets/SessionIcon", () => () => <span data-testid="icon" />);
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-title={title}>{children}</div>
));

describe("WeekView Session", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		useSessionTextColor.mockReturnValue("#111");
		toPath.mockImplementation((p) => p);
	});

	it("renders group and navigates on click", () => {
		render(
			<Session
				group="will"
				year="2024"
				date="2024-06-01"
				name="Talk"
				color="#f00"
				type="audio"
				isPlaying
			/>,
		);
		expect(screen.getByText("Will")).toBeInTheDocument();
		expect(screen.getByText("Talk")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Talk"));
		expect(addPath).toHaveBeenCalled();
	});

	it("hides group when showGroup is false and applies mobile styles", () => {
		useDeviceType.mockReturnValue("phone");
		render(
			<Session
				group="will"
				year="2024"
				date="2024-06-01"
				name="Talk"
				color="#f00"
				showGroup={false}
			/>,
		);
		expect(screen.queryByText("Will")).not.toBeInTheDocument();
	});
});
