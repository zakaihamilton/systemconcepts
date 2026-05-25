import { clear } from "@storage/local";
import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { goBackPage, replacePath } from "@util/domain/views";
import React from "react";
import ClearStorage from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views");
jest.mock("@storage/local");
jest.mock("@widgets/Dialog", () => ({ title, children, actions }) => (
	<div data-testid="dialog">
		<h1>{title}</h1>
		{children}
		<div data-testid="actions">{actions}</div>
	</div>
));

describe("ClearStorage Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			CLEAR_STORAGE: "Clear Storage",
			CANCEL: "Cancel",
			CONFIRM_CLEAR_STORAGE: "Are you sure?",
		});
	});

	it("renders dialog with confirm message", () => {
		const { getByText } = render(<ClearStorage />);
		expect(getByText("Are you sure?")).toBeInTheDocument();
	});

	it("calls goBackPage when cancel is clicked", () => {
		const { getByText } = render(<ClearStorage />);
		fireEvent.click(getByText("Cancel"));
		expect(goBackPage).toHaveBeenCalled();
	});

	it("calls clear and replacePath when reset is clicked", async () => {
		delete window.location;
		window.location = { reload: jest.fn() };
		const { getByRole } = render(<ClearStorage />);
		fireEvent.click(getByRole("button", { name: "Clear Storage" }));
		expect(clear).toHaveBeenCalled();
		// replacePath is called in async reset
		await React.act(async () => {});
		expect(replacePath).toHaveBeenCalledWith("");
	});
});
