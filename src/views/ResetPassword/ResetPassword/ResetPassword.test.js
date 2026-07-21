import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import Cookies from "js-cookie";
import ResetPassword from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("js-cookie");
jest.mock("@util/api/fetch");
jest.mock("@util/domain/views");
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
		}) => {
			const [value, setValue] = state;
			return (
				<input
					data-testid={`input-${props.name}`}
					value={value || ""}
					onChange={(e) => setValue(e.target.value)}
					{...props}
				/>
			);
		},
);

describe("ResetPassword View", () => {
	const mockTranslations = {
		RESET_PASSWORD: "Reset Password",
		CHANGE_PASSWORD: "Change Password",
		BACK: "Back",
		ID: "ID",
		NEW_PASSWORD: "New Password",
		REMEMBER_ME: "Remember Me",
		RESET_EMAIL_SENT: "Reset email sent",
		EMPTY_PASSWORD: "Empty password",
		PASSWORD_TOO_SHORT: "Password too short",
		PASSWORD_TOO_LONG: "Password too long",
		EMPTY_FIELD: "Empty field",
		ACCESS_DENIED: "Access denied",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		Cookies.get.mockReturnValue(null);
	});

	it("renders reset password form when no code is provided", () => {
		render(<ResetPassword />);
		expect(screen.getAllByText("Reset Password").length).toBeGreaterThan(0);
		expect(screen.getByTestId("input-userid")).toBeInTheDocument();
		expect(screen.queryByTestId("input-newpassword")).not.toBeInTheDocument();
	});

	it("renders change password form when code is provided", () => {
		render(<ResetPassword path="code123" />);
		expect(screen.getAllByText("Change Password").length).toBeGreaterThan(0);
		expect(screen.getByTestId("input-userid")).toBeInTheDocument();
		expect(screen.getByTestId("input-newpassword")).toBeInTheDocument();
	});

	it("requests a password reset with a JSON action", async () => {
		fetchJSON.mockResolvedValue({});
		render(<ResetPassword />);

		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Reset Password/i }));

		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/login",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ action: "reset-request", id: "testuser" }),
				}),
			);
		});
	});

	it("confirms a password reset with a JSON action", async () => {
		fetchJSON.mockResolvedValue({ hash: "newhash" });
		render(<ResetPassword path="code123" />);

		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Change Password/i }));

		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/login",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						action: "reset-confirm",
						id: "testuser",
						newPassword: "password123",
						code: "code123",
					}),
				}),
			);
		});
	});

	it("shows reset email confirmation after a successful request", async () => {
		fetchJSON.mockResolvedValue({});
		render(<ResetPassword />);
		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Reset Password/i }));
		await waitFor(() => {
			expect(screen.getByText("Reset email sent")).toBeInTheDocument();
		});
		expect(
			screen.getByRole("button", { name: /Reset Password/i }),
		).toBeDisabled();
	});

	it("blocks confirm when the new password is invalid", () => {
		render(<ResetPassword path="code123" />);
		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "short" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Change Password/i }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it("submits confirm on Enter and navigates home on success", async () => {
		fetchJSON.mockResolvedValue({});
		render(<ResetPassword path="code123" />);
		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "password123" },
		});
		fireEvent.keyDown(screen.getByTestId("input-newpassword"), {
			keyCode: 13,
		});
		await waitFor(() => {
			expect(setPath).toHaveBeenCalledWith("");
		});
	});

	it("shows translated errors from the API response", async () => {
		fetchJSON.mockResolvedValue({ err: "ACCESS_DENIED" });
		render(<ResetPassword />);
		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Reset Password/i }));
		await waitFor(() => {
			expect(screen.getByText("Access denied")).toBeInTheDocument();
		});
	});

	it("renders RTL layout with remember-me when a code is present", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		render(<ResetPassword path="code123" />);
		fireEvent.click(screen.getByRole("checkbox"));
		expect(screen.getByTestId("input-newpassword")).toBeInTheDocument();
	});

	it("rejects an overlong password during confirm", () => {
		render(<ResetPassword path="code123" />);
		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "x".repeat(73) },
		});
		fireEvent.click(screen.getByRole("button", { name: /Change Password/i }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it('calls setHash("account") when back button is clicked', () => {
		render(<ResetPassword />);
		fireEvent.click(screen.getByRole("button", { name: /Back/i }));
		expect(setHash).toHaveBeenCalledWith("account");
	});
});
