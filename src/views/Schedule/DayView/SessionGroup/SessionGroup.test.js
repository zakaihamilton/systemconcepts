import { render, screen } from "@testing-library/react";
import SessionGroup from "./SessionGroup";

jest.mock("@util/data/colors", () => ({
	useSessionTextColor: jest.fn(() => "#111"),
}));

jest.mock("../Session", () => ({
	__esModule: true,
	default: ({ name, isPlaying, typeOrder }) => (
		<div
			data-testid={`session-${name}`}
			data-playing={String(!!isPlaying)}
			data-order={typeOrder}
		>
			{name}
		</div>
	),
}));

describe("SessionGroup", () => {
	it("capitalizes the group label and sorts sessions by typeOrder", () => {
		render(
			<SessionGroup
				group="american"
				sessions={[
					{
						name: "B",
						key: "b",
						typeOrder: 2,
						color: "#f00",
						group: "american",
						date: "2024-01-02",
					},
					{
						name: "A",
						key: "a",
						typeOrder: 1,
						color: "#f00",
						group: "american",
						date: "2024-01-01",
					},
				]}
			/>,
		);

		expect(screen.getByText("American")).toBeInTheDocument();
		const sessions = screen.getAllByTestId(/session-/);
		expect(sessions.map((node) => node.textContent)).toEqual(["A", "B"]);
	});

	it("marks the playing session and falls back to name as key", () => {
		render(
			<SessionGroup
				group="ai"
				playingSession={{ name: "Live", group: "ai", date: "2024-05-05" }}
				sessions={[
					{ name: "Live", color: "#0f0", group: "ai", date: "2024-05-05" },
					{ name: "Other", color: "#0f0", group: "ai", date: "2024-05-06" },
				]}
			/>,
		);

		expect(screen.getByTestId("session-Live")).toHaveAttribute(
			"data-playing",
			"true",
		);
		expect(screen.getByTestId("session-Other")).toHaveAttribute(
			"data-playing",
			"false",
		);
		expect(screen.getByText("Ai")).toBeInTheDocument();
	});

	it("treats missing typeOrder as zero when sorting", () => {
		render(
			<SessionGroup
				group="study"
				sessions={[
					{
						name: "Later",
						key: "2",
						typeOrder: 5,
						color: "#00f",
						group: "study",
						date: "1",
					},
					{ name: "First", key: "1", color: "#00f", group: "study", date: "2" },
				]}
			/>,
		);
		const sessions = screen.getAllByTestId(/session-/);
		expect(sessions[0]).toHaveTextContent("First");
		expect(sessions[1]).toHaveTextContent("Later");
	});
});
