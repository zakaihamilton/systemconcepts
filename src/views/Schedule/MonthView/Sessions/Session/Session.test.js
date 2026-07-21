import { fireEvent, render, screen } from "@testing-library/react";
import { useSessionTextColor } from "@util/data/colors";
import { addPath, toPath } from "@util/domain/views";
import Session from "./Session.js";

jest.mock("@util/data/colors", () => ({
	useSessionTextColor: jest.fn(() => "#000"),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((p) => p),
}));
jest.mock("@ui/Link", () => ({ children, onClick, href }) => (
	<a href={href} onClick={onClick}>
		{children}
	</a>
));
jest.mock("@widgets/SessionIcon", () => () => <span data-testid="icon" />);

describe("MonthView Sessions Session", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useSessionTextColor.mockReturnValue("#222");
		toPath.mockImplementation((p) => p);
	});

	it("renders name, group, and navigates", () => {
		render(
			<Session
				group="alpha"
				year="2024"
				date="2024-06-01"
				name="Meet"
				color="#0f0"
				type="video"
				isPlaying
			/>,
		);
		expect(screen.getByText("Meet")).toBeInTheDocument();
		expect(screen.getByText("Alpha")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Meet"));
		expect(addPath).toHaveBeenCalled();
	});
});
