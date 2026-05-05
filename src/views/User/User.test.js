import { MainStore } from "@components/Main";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { fetchJSON, useFetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import { goBackPage, useParentPath } from "@util/views";
import User from "./User";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/views");
jest.mock("@util/fetch");
jest.mock(
	"@widgets/Input",
	() =>
		({ state, label, onValidate, validate, ...props }) => {
			const [value, setValue] = state || [];
			return (
				<input
					data-testid={`input-${props.id}`}
					value={value || ""}
					onChange={(e) => setValue && setValue(e.target.value)}
					{...props}
				/>
			);
		},
);

describe("User View", () => {
	const mockTranslations = {
		USER: "User",
		EDIT_ACCOUNT: "Edit Account",
		BACK: "Back",
		ID: "ID",
		EMAIL_ADDRESS: "Email Address",
		FIRST_NAME: "First Name",
		LAST_NAME: "Last Name",
		SAVE: "Save",
		CANCEL: "Cancel",
	};

	const mockUser = {
		id: "testuser",
		email: "test@example.com",
		firstName: "Test",
		lastName: "User",
		role: "visitor",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		useParentPath.mockReturnValue("#users");
		useFetchJSON.mockReturnValue([mockUser, jest.fn(), false]);
	});

	it("renders user details form", () => {
		const { getByText, getByTestId } = render(<User path="testuser" />);
		expect(getByText("User")).toBeInTheDocument();
		expect(getByTestId("input-id")).toBeInTheDocument();
		expect(getByTestId("input-email")).toBeInTheDocument();
	});

	it("renders edit account title when parent path is #account", () => {
		useParentPath.mockReturnValue("#account");
		const { getByText } = render(<User path="testuser" />);
		expect(getByText("Edit Account")).toBeInTheDocument();
	});

	it("calls fetchJSON on save", async () => {
		fetchJSON.mockResolvedValue({});
		const { getByText } = render(<User path="testuser" />);

		fireEvent.click(getByText("Save"));

		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/users",
				expect.objectContaining({
					method: "PUT",
				}),
			);
			expect(goBackPage).toHaveBeenCalled();
		});
	});

	it("calls goBackPage when cancel button is clicked", () => {
		const { getByText } = render(<User path="testuser" />);
		fireEvent.click(getByText("Cancel"));
		expect(goBackPage).toHaveBeenCalled();
	});
});
