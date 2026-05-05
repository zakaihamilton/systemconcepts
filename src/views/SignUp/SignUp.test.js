import { MainStore } from "@components/Main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import { setHash } from "@util/views";
import SignUp from "./SignUp";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/fetch");
jest.mock("js-cookie");
jest.mock("@util/views");
jest.mock(
	"@widgets/Input",
	() =>
		({ state, label, onValidate, validate, ...props }) => {
			const [value, setValue] = state;
			return (
				<input
					data-testid={`input-${props.name}`}
					value={value}
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
					method: "PUT",
				}),
			);
		});
	});

	it('calls setHash("account") when back button is clicked', () => {
		render(<SignUp />);
		fireEvent.click(screen.getByRole("button", { name: /Back/i }));
		expect(setHash).toHaveBeenCalledWith("account");
	});
});
