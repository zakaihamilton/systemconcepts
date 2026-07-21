import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import Cookies from "js-cookie";
import SignUp from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/api/fetch");
jest.mock("js-cookie");
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

describe("SignUp View", () => {
	const mockTranslations = {
		SIGN_UP: "Sign Up",
		BACK: "Back",
		ID: "ID",
		FIRST_NAME: "First Name",
		LAST_NAME: "Last Name",
		EMAIL_ADDRESS: "Email Address",
		PASSWORD: "Password",
		REMEMBER_ME: "Remember Me",
		HAVE_ACCOUNT: "Already have an account? Sign In",
		EMPTY_EMAIL: "Empty email",
		BAD_EMAIL: "Bad email",
		EMPTY_PASSWORD: "Empty password",
		PASSWORD_TOO_SHORT: "Password too short",
		PASSWORD_TOO_LONG: "Password too long",
		EMPTY_FIELD: "Empty field",
		BAD_ID: "Bad id",
		ACCESS_DENIED: "Access denied",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
	});

	it("renders sign up form", () => {
		render(<SignUp />);
		expect(screen.getAllByText("Sign Up").length).toBeGreaterThan(0);
		expect(screen.getByTestId("input-username")).toBeInTheDocument();
		expect(screen.getByTestId("input-fname")).toBeInTheDocument();
		expect(screen.getByTestId("input-lname")).toBeInTheDocument();
		expect(screen.getByTestId("input-email")).toBeInTheDocument();
		expect(screen.getByTestId("input-password")).toBeInTheDocument();
	});

	it("calls fetchJSON on submit", async () => {
		fetchJSON.mockResolvedValue({ hash: "newhash" });
		render(<SignUp />);

		fireEvent.change(screen.getByTestId("input-username"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-fname"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByTestId("input-lname"), {
			target: { value: "User" },
		});
		fireEvent.change(screen.getByTestId("input-email"), {
			target: { value: "test@example.com" },
		});
		fireEvent.change(screen.getByTestId("input-password"), {
			target: { value: "password123" },
		});

		fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

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
		render(<SignUp />);
		fireEvent.click(screen.getByRole("button", { name: /Back/i }));
		expect(setHash).toHaveBeenCalledWith("account");
	});

	it("blocks submit for invalid email, id, and password", () => {
		render(<SignUp />);
		fireEvent.change(screen.getByTestId("input-username"), {
			target: { value: "bad id!" },
		});
		fireEvent.change(screen.getByTestId("input-fname"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByTestId("input-lname"), {
			target: { value: "User" },
		});
		fireEvent.change(screen.getByTestId("input-email"), {
			target: { value: "not-an-email" },
		});
		fireEvent.change(screen.getByTestId("input-password"), {
			target: { value: "short" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});

	it("navigates home after a successful registration", async () => {
		fetchJSON.mockResolvedValue({});
		render(<SignUp />);
		fireEvent.change(screen.getByTestId("input-username"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-fname"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByTestId("input-lname"), {
			target: { value: "User" },
		});
		fireEvent.change(screen.getByTestId("input-email"), {
			target: { value: "test@example.com" },
		});
		fireEvent.change(screen.getByTestId("input-password"), {
			target: { value: "password123" },
		});
		fireEvent.submit(
			screen.getByRole("button", { name: /Sign Up/i }).closest("form"),
		);
		await waitFor(() => {
			expect(setPath).toHaveBeenCalledWith("");
		});
	});

	it("clears cookies and shows translated errors on failure", async () => {
		fetchJSON.mockResolvedValue({ err: "ACCESS_DENIED" });
		render(<SignUp />);
		fireEvent.change(screen.getByTestId("input-username"), {
			target: { value: "testuser" },
		});
		fireEvent.change(screen.getByTestId("input-fname"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByTestId("input-lname"), {
			target: { value: "User" },
		});
		fireEvent.change(screen.getByTestId("input-email"), {
			target: { value: "test@example.com" },
		});
		fireEvent.change(screen.getByTestId("input-password"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));
		await waitFor(() => {
			expect(Cookies.set).toHaveBeenCalledWith("id", "");
			expect(Cookies.set).toHaveBeenCalledWith("hash", "");
			expect(screen.getByText("Access denied")).toBeInTheDocument();
		});
	});

	it("renders RTL layout and toggles remember me", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		render(<SignUp />);
		fireEvent.click(screen.getByRole("checkbox"));
		expect(screen.getByTestId("input-username")).toBeInTheDocument();
	});

	it("rejects empty fields, bad ids, and overlong passwords", () => {
		render(<SignUp />);
		fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));
		expect(fetchJSON).not.toHaveBeenCalled();

		fireEvent.change(screen.getByTestId("input-username"), {
			target: { value: "valid-user" },
		});
		fireEvent.change(screen.getByTestId("input-fname"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByTestId("input-lname"), {
			target: { value: "User" },
		});
		fireEvent.change(screen.getByTestId("input-email"), {
			target: { value: "test@example.com" },
		});
		fireEvent.change(screen.getByTestId("input-password"), {
			target: { value: "x".repeat(73) },
		});
		fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));
		expect(fetchJSON).not.toHaveBeenCalled();
	});
});
