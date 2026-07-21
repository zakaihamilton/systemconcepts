import { MainStore } from "@components/Main";
import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";
import { clearBundleCache } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import Account from "./index.js";

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
		deleteFolder: jest.fn().mockResolvedValue(),
	},
}));
jest.mock("@sync/sync", () => ({
	clearBundleCache: jest.fn().mockResolvedValue(),
}));
jest.mock("@sync/syncState", () => ({
	UpdateSessionsStore: {
		update: jest.fn(),
	},
	loadUserSyncState: jest.fn().mockResolvedValue(),
}));
jest.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthn: jest.fn().mockReturnValue(true),
	startAuthentication: jest.fn(),
	startRegistration: jest.fn(),
}));

describe("Account View", () => {
	const mockTranslations = {
		SIGN_IN: "Sign In",
		SIGNED_IN: "Signed In",
		ID: "ID",
		PASSWORD: "Password",
		REMEMBER_ME: "Remember me",
		SIGN_OUT: "Sign Out",
		CREATE_PASSKEY: "Create passkey",
		SIGN_IN_WITH_PASSKEY: "Sign in with passkey",
		REGISTER_PASSKEY: "Register passkey",
		DELETE: "Delete",
		ENTER_PASSKEY_NAME: "Enter name",
		ERROR: "Error",
		SIGN_UP: "Sign Up",
		EMPTY_FIELD: "Empty field",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		Cookies.get.mockReturnValue(null);
		Cookies.set = jest.fn();
		fetchJSON.mockResolvedValue([]);
		browserSupportsWebAuthn.mockReturnValue(true);
	});

	it("renders sign in form when not signed in", async () => {
		render(<Account />);
		expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
		expect(await screen.findByLabelText(/ID/)).toBeInTheDocument();
		expect(await screen.findByLabelText(/Password/)).toBeInTheDocument();
	});

	it("renders signed in state when cookies are present", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue([
			{ id: "pk1", name: "My Passkey", createdAt: new Date().toISOString() },
		]);

		render(<Account />);
		expect(await screen.findByText("Signed In")).toBeInTheDocument();
		expect(await screen.findByText("My Passkey")).toBeInTheDocument();
	});

	it("submits a boolean remember value after it is toggled", async () => {
		const user = userEvent.setup();
		fetchJSON.mockResolvedValue({ role: "visitor" });
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
		expect(fetchJSON.mock.calls.some(([url]) => url === "/api/login")).toBe(
			false,
		);
	});

	it("handles login failure", async () => {
		const user = userEvent.setup();
		fetchJSON.mockResolvedValue({ err: "bad credentials" });
		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		await waitFor(() => {
			expect(screen.getByText(/bad credentials/i)).toBeInTheDocument();
		});
	});

	it("signs out and clears cookies", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue([]);
		render(<Account />);
		expect(await screen.findByText("Signed In")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
		await waitFor(() => {
			expect(Cookies.set).toHaveBeenCalledWith("id", "");
			expect(Cookies.set).toHaveBeenCalledWith("hash", "");
		});
	});

	it("hides create-passkey checkbox when WebAuthn is unsupported", () => {
		browserSupportsWebAuthn.mockReturnValue(false);
		render(<Account />);
		expect(screen.queryByLabelText(/Create passkey/i)).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		).toBeInTheDocument();
	});

	it("respects rtl direction", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		render(<Account />);
		expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
	});

	it("redirects via setPath after successful login", async () => {
		const user = userEvent.setup();
		fetchJSON.mockResolvedValue({ role: "user" });
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
		fetchJSON.mockResolvedValue({ role: "user" });
		render(<Account redirect="sessions" />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign In" }));
		await waitFor(() => {
			expect(setHash).toHaveBeenCalledWith("sessions");
		});
	});

	it("registers a passkey when signed in", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		window.prompt = jest.fn().mockReturnValue("Work laptop");
		startRegistration.mockResolvedValue({ id: "cred" });
		fetchJSON
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ verified: true });

		render(<Account />);
		await screen.findByText("Signed In");
		fireEvent.click(screen.getByRole("button", { name: "Register passkey" }));

		await waitFor(() => {
			expect(startRegistration).toHaveBeenCalled();
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/passkey?action=register-verify&id=testuser",
				expect.objectContaining({ method: "POST" }),
			);
		});
	});

	it("deletes a passkey after confirmation", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		window.confirm = jest.fn().mockReturnValue(true);
		fetchJSON.mockResolvedValue([
			{ id: "pk1", name: "My Passkey", createdAt: new Date().toISOString() },
		]);

		render(<Account />);
		await screen.findByText("My Passkey");
		fireEvent.click(screen.getByRole("button", { name: "Delete My Passkey" }));

		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/passkey?id=testuser&credentialId=pk1",
				{ method: "DELETE" },
			);
		});
	});

	it("skips passkey deletion when confirmation is cancelled", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		window.confirm = jest.fn().mockReturnValue(false);
		fetchJSON.mockResolvedValue([
			{ id: "pk1", name: "My Passkey", createdAt: new Date().toISOString() },
		]);

		render(<Account />);
		await screen.findByText("My Passkey");
		fireEvent.click(screen.getByRole("button", { name: "Delete My Passkey" }));

		expect(
			fetchJSON.mock.calls.some(
				([url, opts]) =>
					url.includes("credentialId=pk1") && opts?.method === "DELETE",
			),
		).toBe(false);
	});

	it("logs in with a passkey", async () => {
		const user = userEvent.setup();
		startAuthentication.mockResolvedValue({ id: "assertion" });
		fetchJSON
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ role: "user" });

		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.click(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		);

		await waitFor(() => {
			expect(startAuthentication).toHaveBeenCalled();
			expect(setPath).toHaveBeenCalled();
		});
	});

	it("creates a passkey after login when checkbox is checked", async () => {
		const user = userEvent.setup();
		window.prompt = jest.fn().mockReturnValue(null);
		startRegistration.mockResolvedValue({ id: "cred" });
		fetchJSON
			.mockResolvedValueOnce({ role: "user" })
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ verified: true });

		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByLabelText(/Create passkey/i));
		await user.click(screen.getByRole("button", { name: "Sign In" }));

		await waitFor(() => {
			expect(startRegistration).toHaveBeenCalled();
		});
	});

	it("clears session store and bundle cache on sign out", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue([]);

		render(<Account />);
		await screen.findByText("Signed In");
		fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

		await waitFor(() => {
			expect(clearBundleCache).toHaveBeenCalledWith({ userId: "testuser" });
			expect(storage.deleteFolder).toHaveBeenCalledWith("local");
			expect(UpdateSessionsStore.update).toHaveBeenCalled();
		});
	});

	it("shows error when passkey registration options fail", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce({ err: "PASSKEY_DENIED" });

		render(<Account />);
		await screen.findByText("Signed In");
		fireEvent.click(screen.getByRole("button", { name: "Register passkey" }));

		await waitFor(() => {
			expect(screen.getByText("PASSKEY_DENIED")).toBeInTheDocument();
		});
	});

	it("shows error when passkey registration is not verified", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		window.prompt = jest.fn().mockReturnValue("Key");
		startRegistration.mockResolvedValue({ id: "cred" });
		fetchJSON
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ verified: false });

		render(<Account />);
		await screen.findByText("Signed In");
		fireEvent.click(screen.getByRole("button", { name: "Register passkey" }));

		await waitFor(() => {
			expect(
				screen.getByText(/PASSKEY_REGISTRATION_FAILED/i),
			).toBeInTheDocument();
		});
	});

	it("shows error when passkey deletion fails", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		window.confirm = jest.fn().mockReturnValue(true);
		fetchJSON
			.mockResolvedValueOnce([
				{ id: "pk1", name: "My Passkey", createdAt: new Date().toISOString() },
			])
			.mockRejectedValueOnce("DELETE_FAILED");

		render(<Account />);
		await screen.findByText("My Passkey");
		fireEvent.click(screen.getByRole("button", { name: "Delete My Passkey" }));

		await waitFor(() => {
			expect(screen.getByText("DELETE_FAILED")).toBeInTheDocument();
		});
	});

	it("does not start passkey login when id is empty", async () => {
		render(<Account />);
		fireEvent.click(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		);
		expect(startAuthentication).not.toHaveBeenCalled();
	});

	it("shows error when passkey login verification fails", async () => {
		const user = userEvent.setup();
		startAuthentication.mockResolvedValue({ id: "assertion" });
		fetchJSON
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ err: "PASSKEY_LOGIN_FAILED" });

		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.click(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/PASSKEY_LOGIN_FAILED/i)).toBeInTheDocument();
		});
	});

	it("redirects via setHash after passkey login when redirect prop is set", async () => {
		const user = userEvent.setup();
		startAuthentication.mockResolvedValue({ id: "assertion" });
		fetchJSON
			.mockResolvedValueOnce({ challenge: "abc" })
			.mockResolvedValueOnce({ role: "user" });

		render(<Account redirect="sessions" />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.click(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		);

		await waitFor(() => {
			expect(setHash).toHaveBeenCalledWith("sessions");
		});
	});

	it("shows error when passkey auth options fail", async () => {
		const user = userEvent.setup();
		fetchJSON.mockResolvedValueOnce({ err: "PASSKEY_OPTIONS_FAILED" });

		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.click(
			screen.getByRole("button", { name: "Sign in with passkey" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/PASSKEY_OPTIONS_FAILED/i)).toBeInTheDocument();
		});
	});

	it("continues login when post-login passkey creation fails", async () => {
		const user = userEvent.setup();
		window.prompt = jest.fn().mockReturnValue("Laptop");
		startRegistration.mockRejectedValue(new Error("registration failed"));
		fetchJSON.mockResolvedValueOnce({ role: "user" });

		render(<Account />);
		await user.type(screen.getByLabelText("ID"), "person@example.com");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByLabelText(/Create passkey/i));
		await user.click(screen.getByRole("button", { name: "Sign In" }));

		await waitFor(() => {
			expect(setPath).toHaveBeenCalled();
		});
	});
});
