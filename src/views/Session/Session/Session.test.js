import { render } from "@testing-library/react";
import { useFetch } from "@util/api/fetch";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import SessionPage from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn().mockReturnValue({ order: "desc", orderBy: "date" }),
	},
}));
jest.mock("@util/api/fetch");
jest.mock("@util/browser/styles");
jest.mock("@widgets/Group", () => () => <div data-testid="group" />);
jest.mock("@widgets/Summary", () => () => <div data-testid="summary" />);
jest.mock("@widgets/Image", () => ({ path }) => (
	<div data-testid="image" data-path={path} />
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));

describe("Session View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			NOT_FOUND: "Not Found",
		});
		useDeviceType.mockReturnValue("desktop");
		useSessions.mockReturnValue([[], true]); // loading state
		useFetch.mockReturnValue([null, null, false]);
	});

	it("renders loading state", () => {
		const { getByText } = render(<SessionPage />);
		expect(getByText("Loading...")).toBeInTheDocument();
	});

	it("renders not found state if session missing", () => {
		useSessions.mockReturnValue([[], false]); // not loading, but empty
		const { getByText } = render(<SessionPage />);
		expect(getByText("Not Found")).toBeInTheDocument();
	});

	it("renders session details when available", () => {
		const mockSession = {
			group: "test",
			year: "2024",
			date: "2024-05-05",
			name: "Test Session",
			color: "#ff0000",
			duration: 3600,
		};
		useSessions.mockReturnValue([[mockSession], false]);

		const { getByText, getByTestId } = render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		expect(getByText("Test Session")).toBeInTheDocument();
		expect(getByTestId("group")).toBeInTheDocument();
		expect(getByTestId("summary")).toBeInTheDocument();
	});

	it("replaces stale DigitalOcean image URLs with the equivalent Wasabi path", () => {
		const mockSession = {
			id: "2026-06-30 Beastly",
			group: "will",
			year: "2026",
			date: "2026-06-30",
			name: "Beastly",
			imagePath:
				"https://screens.sfo2.digitaloceanspaces.com/sessions/will/2026/2026-06-30%20Beastly.png",
		};
		useSessions.mockReturnValue([[mockSession], false]);

		const { getByTestId } = render(
			<SessionPage group="will" year="2026" date="2026-06-30" name="Beastly" />,
		);

		expect(getByTestId("image")).toHaveAttribute(
			"data-path",
			"wasabi/will/2026/2026-06-30 Beastly.png",
		);
	});
});
