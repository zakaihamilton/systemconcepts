import { render, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import Statistics from "./index.js";

jest.mock("@util/translations");
jest.mock("@widgets/Message", () => () => <div data-testid="message" />);

describe("Statistics Component", () => {
	const mockGroup = { name: "testgroup" };
	const mockSessions = [
		{ group: "testgroup", name: "Session 1" },
		{ group: "testgroup", name: "Session 2 - AI" },
		{ group: "testgroup", name: "Overview - Session 3" },
		{ group: "othergroup", name: "Session 4" },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			STATISTICS: "Statistics",
			SESSIONS: "Sessions",
			CLOSE: "Close",
			LOADING: "Loading",
		});
	});

	it("renders statistics when open", async () => {
		const { getByText } = render(
			<Statistics
				group={mockGroup}
				open={true}
				onClose={() => {}}
				sessions={mockSessions}
			/>,
		);

		await waitFor(() => {
			expect(getByText("3")).toBeInTheDocument(); // total sessions in testgroup
			// Wait, the logic is: filter sessions by group first.
			// groupSessions = [S1, S2 - AI, O - S3] (length 3)
			// So total should be 3.
		});
	});

	it("calculates correct stats", async () => {
		const { getByText, getAllByText } = render(
			<Statistics
				group={mockGroup}
				open={true}
				onClose={() => {}}
				sessions={mockSessions}
			/>,
		);

		await waitFor(() => {
			// sessions.filter(session => session.group === group.name) -> 3 items
			expect(getByText("3")).toBeInTheDocument(); // Total
			expect(getAllByText("1").length).toBe(3); // Standard, Overview, AI all have 1 item
			// AI and Overview both show as '1' in the table align right.
			// We might need to check the row content specifically but this is enough for a basic check.
		});
	});
});
