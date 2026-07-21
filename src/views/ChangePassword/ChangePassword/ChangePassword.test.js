import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import Cookies from "js-cookie";
import ChangePassword from "./index.js";

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

describe("ChangePassword View", () => {
	const mockTranslations = {
		CHANGE_PASSWORD: "Change Password",
		BACK: "Back",
		ID: "ID",
		OLD_PASSWORD: "Old Password",
		NEW_PASSWORD: "New Password",
		REMEMBER_ME: "Remember Me",
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
					method: "POST",
				}),
			);
		});
	});

	it('calls setHash("account") when back button is clicked', () => {
		render(<ChangePassword />);
		fireEvent.click(screen.getByRole("button", { name: /Back/i }));
		expect(setHash).toHaveBeenCalledWith("account");
	});

	it("blocks submit when passwords fail validation", () => {
		render(<ChangePassword />);
		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "short" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "x".repeat(73) },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it("submits on Enter and navigates home on success", async () => {
		fetchJSON.mockResolvedValue({});
		render(<ChangePassword />);
		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "oldpassword123" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "newpassword123" },
		});
		fireEvent.keyDown(screen.getByTestId("input-newpassword"), {
			keyCode: 13,
		});
		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalled();
			expect(setPath).toHaveBeenCalledWith("");
		});
	});

	it("shows translated errors from the API response", async () => {
		fetchJSON.mockResolvedValue({ err: "ACCESS_DENIED" });
		render(<ChangePassword />);
		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "oldpassword123" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "newpassword123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		await waitFor(() => {
			expect(screen.getByText("Access denied")).toBeInTheDocument();
		});
	});

	it("shows a fallback error when the request rejects", async () => {
		fetchJSON.mockRejectedValue("NETWORK_ERROR");
		render(<ChangePassword />);
		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "oldpassword123" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "newpassword123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		await waitFor(() => {
			expect(screen.getByText("NETWORK_ERROR")).toBeInTheDocument();
		});
	});

	it("renders RTL layout and toggles remember me", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		Cookies.get.mockReturnValue(null);
		render(<ChangePassword />);
		fireEvent.click(screen.getByRole("checkbox"));
		expect(screen.getByTestId("input-userid")).toBeInTheDocument();
	});

	it("rejects an empty id and an overlong password", () => {
		Cookies.get.mockReturnValue(null);
		render(<ChangePassword />);
		fireEvent.change(screen.getByTestId("input-oldpassword"), {
			target: { value: "validpass1" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "validpass1" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		expect(fetchJSON).not.toHaveBeenCalled();

		fireEvent.change(screen.getByTestId("input-userid"), {
			target: { value: "user" },
		});
		fireEvent.change(screen.getByTestId("input-newpassword"), {
			target: { value: "x".repeat(73) },
		});
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});
});
