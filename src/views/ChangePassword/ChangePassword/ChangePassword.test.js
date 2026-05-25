import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import { setHash } from "@util/views";
import Cookies from "js-cookie";
import ChangePassword from "./index.js";

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

describe("ChangePassword View", () => {
	const mockTranslations = {
		CHANGE_PASSWORD: "Change Password",
		BACK: "Back",
		ID: "ID",
		OLD_PASSWORD: "Old Password",
		NEW_PASSWORD: "New Password",
		REMEMBER_ME: "Remember Me",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		Cookies.get.mockReturnValue("testuser");
	});

	it("renders change password form", () => {
		render(<ChangePassword />);
		expect(screen.getAllByText("Change Password").length).toBeGreaterThan(0);
		expect(screen.getByTestId("input-userid")).toBeInTheDocument();
		expect(screen.getByTestId("input-oldpassword")).toBeInTheDocument();
		expect(screen.getByTestId("input-newpassword")).toBeInTheDocument();
	});

	it("calls fetchJSON on submit", async () => {
		fetchJSON.mockResolvedValue({ hash: "newhash" });
		render(<ChangePassword />);

		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "oldpassword123" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "newpassword123" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/login",
				expect.objectContaining({
					method: "PUT",
				}),
			);
		});
	});

	it('calls setHash("account") when back button is clicked', () => {
		render(<ChangePassword />);
		fireEvent.click(screen.getByRole("button", { name: /Back/i }));
		expect(setHash).toHaveBeenCalledWith("account");
	});
});
