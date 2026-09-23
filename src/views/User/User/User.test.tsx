import { MainStore } from "@components/Main";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { fetchJSON, useFetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { goBackPage, useParentPath } from "@util/domain/views";
import User from "./index";

jest.mock("@util/domain/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/domain/views");
jest.mock("@util/api/fetch");
jest.mock(
	"@widgets/Input",
	() =>
		({
			state,
			label,
			onValidate,
			validate,
			background,
			select,
			fullWidth,
			icon,
			tooltip,
			mapping,
			helperText,
			...props
		}: any) => {
			const [value, setValue] = state || [];
			const error = validate && onValidate ? onValidate(value) : "";
			return (
				<input
					data-testid={`input-${props.id}`}
					data-error={error || ""}
					value={value || ""}
					onChange={(e) => setValue && setValue(e.target.value)}
					{...props}
				/>
			);
		},
);

describe("User View", () => {
	const mockTranslations: Record<string, string> = {
		USER: "User",
		EDIT_ACCOUNT: "Edit Account",
		BACK: "Back",
		ID: "ID",
		EMAIL_ADDRESS: "Email Address",
		FIRST_NAME: "First Name",
		LAST_NAME: "Last Name",
		ROLE: "Role",
		PASSWORD: "Password",
		SAVE: "Save",
		CANCEL: "Cancel",
		EMPTY_EMAIL: "Email required",
		BAD_EMAIL: "Bad email",
		EMPTY_FIELD: "Field required",
		BAD_ID: "Bad id",
		EMPTY_PASSWORD: "Password required",
		PASSWORD_TOO_SHORT: "Password too short",
		PASSWORD_TOO_LONG: "Password too long",
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
		asMock(useTranslations).mockReturnValue(mockTranslations);
		asMock(MainStore.useState).mockReturnValue({ direction: "ltr" });
		asMock(useParentPath).mockReturnValue("#users");
		asMock(useFetchJSON).mockReturnValue([mockUser, jest.fn(), false]);
	});

	it("renders user details form", () => {
		const { getByText, getByTestId } = render(<User path="testuser" />);
		expect(getByText("User")).toBeInTheDocument();
		expect(getByTestId("input-id")).toBeInTheDocument();
		expect(getByTestId("input-email")).toBeInTheDocument();
	});

	it("renders edit account title when parent path is #account", () => {
		asMock(useParentPath).mockReturnValue("#account");
		const { getByText } = render(<User path="testuser" />);
		expect(getByText("Edit Account")).toBeInTheDocument();
	});

	it("calls fetchJSON on save", async () => {
		asMock(fetchJSON).mockResolvedValue({});
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

	it("disables save when required fields are invalid after validation", () => {
		asMock(useFetchJSON).mockReturnValue([
			{ id: "", email: "", firstName: "", lastName: "" },
			jest.fn(),
			false,
		]);
		const { getByText } = render(<User path="testuser" />);
		fireEvent.click(getByText("Save"));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it("shows a translated error when save fails", async () => {
		mockTranslations.SERVER_ERROR = "Server failed";
		asMock(fetchJSON).mockRejectedValue("SERVER_ERROR");
		const { getByText } = render(<User path="testuser" />);

		fireEvent.click(getByText("Save"));

		await waitFor(() => {
			expect(getByText("Server failed")).toBeInTheDocument();
		});
	});

	it("shows a raw error string when no translation exists", async () => {
		asMock(fetchJSON).mockRejectedValue("UNKNOWN_CODE");
		const { getByText } = render(<User path="testuser" />);

		fireEvent.click(getByText("Save"));

		await waitFor(() => {
			expect(getByText("UNKNOWN_CODE")).toBeInTheDocument();
		});
	});

	it("surfaces API errors returned in the response body", async () => {
		const consoleError = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});
		asMock(fetchJSON).mockResolvedValue({ err: "SAVE_FAILED" });
		mockTranslations.SAVE_FAILED = "Could not save";
		const { getByText } = render(<User path="testuser" />);

		fireEvent.click(getByText("Save"));

		await waitFor(() => {
			expect(getByText("Could not save")).toBeInTheDocument();
		});
		asMock(consoleError).mockRestore();
	});

	it("hides id and password fields in edit-account mode", () => {
		asMock(useParentPath).mockReturnValue("#account");
		const { queryByTestId } = render(<User path="testuser" />);
		expect(queryByTestId("input-id")).not.toBeInTheDocument();
		expect(queryByTestId("input-password")).not.toBeInTheDocument();
	});

	it("applies rtl styling to the back button", () => {
		asMock(MainStore.useState).mockReturnValue({ direction: "rtl" });
		const { container } = render(<User path="testuser" />);
		expect(container.querySelector(".rtl")).toBeTruthy();
	});

	it("shows loading progress while fetching user data", () => {
		asMock(useFetchJSON).mockReturnValue([null, jest.fn(), true]);
		const { container } = render(<User path="testuser" />);
		expect(container.querySelector("[role='progressbar']")).toBeTruthy();
	});

	it("blocks save for invalid email and id values", () => {
		asMock(useFetchJSON).mockReturnValue([
			{
				id: "bad id!",
				email: "not-an-email",
				firstName: "Test",
				lastName: "User",
				password: "valid-password",
			},
			jest.fn(),
			false,
		]);
		const { getByText } = render(<User path="testuser" />);
		fireEvent.click(getByText("Save"));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it("surfaces password validation errors after submit", () => {
		asMock(useFetchJSON).mockReturnValue([
			{
				id: "valid-id",
				email: "test@example.com",
				firstName: "Test",
				lastName: "User",
				password: "short",
			},
			jest.fn(),
			false,
		]);
		const { getByText, getByTestId } = render(<User path="testuser" />);
		fireEvent.click(getByText("Save"));
		expect(getByTestId("input-password")).toHaveAttribute(
			"data-error",
			"Password too short",
		);
	});

	it("surfaces password-too-long validation after submit", () => {
		asMock(useFetchJSON).mockReturnValue([
			{
				id: "valid-id",
				email: "test@example.com",
				firstName: "Test",
				lastName: "User",
				password: "x".repeat(73),
			},
			jest.fn(),
			false,
		]);
		const { getByText, getByTestId } = render(<User path="testuser" />);
		fireEvent.click(getByText("Save"));
		expect(getByTestId("input-password")).toHaveAttribute(
			"data-error",
			"Password too long",
		);
	});
});
