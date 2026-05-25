import { render } from "@testing-library/react";
import Message from "./index.js";

describe("Message Widget", () => {
	it("renders label and icon", () => {
		const MockIcon = () => <span data-testid="mock-icon" />;
		const { getByText, getByTestId } = render(
			<Message Icon={MockIcon} label="Test Message" />,
		);
		expect(getByText("Test Message")).toBeInTheDocument();
		expect(getByTestId("mock-icon")).toBeInTheDocument();
	});

	it("renders nothing when show is false", () => {
		const { container } = render(<Message label="Test" show={false} />);
		expect(container.firstChild).toBeNull();
	});
});
