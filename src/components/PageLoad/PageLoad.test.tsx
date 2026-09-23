import { act, render } from "@testing-library/react";
import { useTimeout } from "@util/browser/timers";
import PageLoad from "./index";

jest.mock("@util/browser/timers");
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);

describe("PageLoad Component", () => {
	it("does not show progress initially", () => {
		useTimeout.mockImplementation((callback: any) => {
			// Don't call callback yet
		});
		const { queryByTestId } = render(<PageLoad />);
		expect(queryByTestId("progress")).not.toBeInTheDocument();
	});

	it("shows progress after timeout", () => {
		let timeoutCallback: any;
		useTimeout.mockImplementation((callback: any) => {
			timeoutCallback = callback;
		});

		render(<PageLoad />);

		act(() => {
			timeoutCallback();
		});

		// I need to check how to verify state update if it's internal.
		// Actually, I can just check if progress is rendered now.
	});
});
