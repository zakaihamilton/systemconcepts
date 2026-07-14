import { fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
	it("forwards onClick to the anchor element", () => {
		const handleClick = jest.fn();

		render(
			<Tooltip title="Rows per page" onClick={handleClick}>
				<button type="button">Open</button>
			</Tooltip>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open" }));

		expect(handleClick).toHaveBeenCalledTimes(1);
	});
});
