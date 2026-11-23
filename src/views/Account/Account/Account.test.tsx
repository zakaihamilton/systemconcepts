import { MainStore } from "@components/Main";
import { clearBundleCache } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchJSON } from "@util/api/fetch";
import { setHash, setPath } from "@util/domain/views";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { mockSignedInCookies, setupAuthViewTest } from "../../authTestSetup";
import Account from "./index";

jest.mock("js-cookie");
jest.mock("@util/api/fetch");
jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({
	setHash: jest.fn(),
	setPath: jest.fn(),
}));
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		deleteFolder: jest.fn().mockResolvedValue(undefined),
	},
}));
jest.mock("@sync/sync", () => ({
	clearBundleCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@sync/syncState", () => ({
	UpdateSessionsStore: {
		update: jest.fn(),
	},
	loadUserSyncState: jest.fn().mockResolvedValue(undefined),
}));

describe("Account View", () => {
	const mockTranslations = {
		SIGN_IN: "Sign In",
		SIGNED_IN: "Signed In",
		ID: "ID",
		PASSWORD: "Password",
		REMEMBER_ME: "Remember me",
		SIGN_OUT: "Sign Out",
		ERROR: "Error",
		SIGN_UP: "Sign Up",
		EMPTY_FIELD: "Empty field",
	};

	beforeEach(() => {
		setupAuthViewTest({ translations: mockTranslations, cookieId: null });
		Cookies.set = jest.fn();
		asMock(fetchJSON).mockResolvedValue([]);
	});

	it("renders sign in form when not signed in", async () => {
		render(<Account />);
		expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
		expect(await screen.findByLabelText(/ID/)).toBeInTheDocument();
		expect(await screen.findByLabelText(/Password/)).toBeInTheDocument();
	});

	it("renders signed in state when cookies are present", async () => {
		mockSignedInCookies();

		render(<Account />);
		expect(await screen.findByText("Signed In")).toBeInTheDocument();
	});

	it("submits a boolean remember value after it is toggled", async () => {
		const user = userEvent.setup();
		asMock(fetchJSON).mockResolvedValue({ role: "visitor" });
		render(<Account />);

		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByLabelText("Remember me"));
		await user.click(screen.getByRole("button", { name: "Sign In" }));

		expect(fetchJSON).toHaveBeenCalledWith("/api/login", {
			method: "POST",
			body: JSON.stringify({
				action: "login",
				id: "person@example.com",
				password: "password",
				remember: false,
			}),
		});
	});

	it("does not call login API when fields are empty", async () => {
		const user = userEvent.setup();
		render(<Account />);
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		expect(
			asMock(fetchJSON).mock.calls.some(([url]: any) => url === "/api/login"),
		).toBe(false);
	});

	it("handles login failure", async () => {
		const user = userEvent.setup();
		asMock(fetchJSON).mockResolvedValue({ err: "bad credentials" });
		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		await waitFor(() => {
			expect(screen.getByText(/bad credentials/i)).toBeInTheDocument();
		});
	});

	it("signs out and clears cookies", async () => {
		mockSignedInCookies();
		asMock(fetchJSON).mockResolvedValue([]);
		render(<Account />);
		expect(await screen.findByText("Signed In")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
		await waitFor(() => {
			expect(Cookies.set).toHaveBeenCalledWith("id", "");
			expect(Cookies.set).toHaveBeenCalledWith("hash", "");
		});
	});

	it("respects rtl direction", () => {
		asMock(MainStore.useState).mockReturnValue({ direction: "rtl" });
		render(<Account />);
		expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
	});

	it("redirects via setPath after successful login", async () => {
		const user = userEvent.setup();
		asMock(fetchJSON).mockResolvedValue({ role: "user" });
		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		await waitFor(() => {
			expect(setPath).toHaveBeenCalled();
		});
	});

	it("redirects via setHash when redirect prop is provided", async () => {
		const user = userEvent.setup();
		asMock(fetchJSON).mockResolvedValue({ role: "user" });
		render(<Account redirect="sessions" />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		await waitFor(() => {
			expect(setHash).toHaveBeenCalledWith("sessions");
		});
	});

	it("clears session store and bundle cache on sign out", async () => {
		mockSignedInCookies();
		asMock(fetchJSON).mockResolvedValue([]);

		render(<Account />);
		await screen.findByText("Signed In");
		fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

		await waitFor(() => {
			expect(clearBundleCache).toHaveBeenCalledWith({ userId: "testuser" });
			expect(storage.deleteFolder).toHaveBeenCalledWith("local");
			expect(UpdateSessionsStore.update).toHaveBeenCalled();
		});
	});
});
