import { fireEvent, render, screen } from "@testing-library/react";
import Session from "./Session";

jest.mock("@util/data/colors", () => ({
	useSessionTextColor: jest.fn(() => "#222"),
}));

jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((path) => path),
}));

jest.mock("@widgets/SessionIcon", () => ({
	__esModule: true,
	default: ({ type }) => <span data-testid="icon">{type}</span>,
}));

jest.mock("@ui/Link", () => ({
	__esModule: true,
	default: ({ children, href, onClick, className, style }) => (
		<a href={href} onClick={onClick} className={className} style={style}>
			{children}
		</a>
	),
}));

const { addPath } = require("@util/domain/views");

describe("DayView Session", () => {
	it("renders name, type icon, and navigates on click", () => {
		render(
			<Session
				group="ai"
				year="2024"
				date="2024-01-01"
				name="Talk"
				color="#abc"
				type="video"
			/>,
		);

		expect(screen.getByText("Talk")).toBeInTheDocument();
		expect(screen.getByTestId("icon")).toHaveTextContent("video");
		fireEvent.click(screen.getByText("Talk").closest("a"));
		expect(addPath).toHaveBeenCalledWith(
			expect.stringContaining("session?group=ai"),
		);
	});

	it("applies playing styles when isPlaying is true", () => {
		const { container } = render(
			<Session
				group="ai"
				year="2024"
				date="2024-01-01"
				name="Talk"
				color="#abc"
				type="audio"
				isPlaying
			/>,
		);
		expect(container.querySelector("a").className).toMatch(/playing/);
	});
});
