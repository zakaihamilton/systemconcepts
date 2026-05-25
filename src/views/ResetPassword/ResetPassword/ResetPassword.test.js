import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import Cookies from "js-cookie";
import ResetPassword from "./index.js";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("js-cookie");
jest.mock("@util/fetch");
jest.mock("@util/views");
jest.mock(
	"@widgets/Input",
	() =>
		({ state, label, onValidate, validate, background, select, fullWidth, icon, tooltip, mapping, helperText, ...props }) => {
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

	it("calls fetchJSON with reset:true when no code is provided", async () => {
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
					headers: expect.objectContaining({ reset: true }),
				}),
			);
		});
	});

	it("calls fetchJSON with code when code is provided", async () => {
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
					headers: expect.objectContaining({ code: "code123" }),
				}),
			);
		});
	});
});
