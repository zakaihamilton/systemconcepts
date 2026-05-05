import { MainStore } from "@components/Main";
import { render, screen } from "@testing-library/react";
import { fetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import Cookies from "js-cookie";
import Account from "./Account";

jest.mock("js-cookie");
jest.mock("@util/fetch");
jest.mock("@util/translations");
jest.mock("@util/views");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/storage");
jest.mock("@sync/syncState", () => ({
	UpdateSessionsStore: {
		update: jest.fn(),
	},
}));
jest.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthn: jest.fn().mockReturnValue(true),
}));

describe("Account View", () => {
	const mockTranslations = {
		SIGN_IN: "Sign In",
		SIGNED_IN: "Signed In",
		ID: "ID",
		PASSWORD: "Password",
		SIGN_OUT: "Sign Out",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		Cookies.get.mockReturnValue(null);
		fetchJSON.mockResolvedValue([]);
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
		fetchJSON.mockResolvedValue([{ id: "pk1", name: "My Passkey", createdAt: new Date().toISOString() }]);

		render(<Account />);
		expect(await screen.findByText("Signed In")).toBeInTheDocument();
		expect(await screen.findByText("My Passkey")).toBeInTheDocument();
	});
});
