import { ContentSize } from "@components/Page/Content";
import { render } from "@testing-library/react";
import { useFetchJSON } from "@util/fetch";
import { useSessions } from "@util/sessions";
import { useTranslations } from "@util/translations";
import { useParentParams } from "@util/views";
import Cookies from "js-cookie";
import PlayerPage from "./Player";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ speedToolbar: "bottom" }),
		update: jest.fn(),
	},
}));
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/fetch");
jest.mock("@util/sessions");
jest.mock("@util/views");
jest.mock("@util/history", () => ({
	useRecentHistory: jest.fn().mockReturnValue([[], jest.fn(), false]),
}));
jest.mock("./Audio", () => () => <div data-testid="audio" />);
jest.mock("./Video", () => () => <div data-testid="video" />);
jest.mock("./Transcript", () => () => <div data-testid="transcript" />);
jest.mock("./SpeedSlider", () => () => <div data-testid="speed-slider" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Download", () => () => <div data-testid="download" />);
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("js-cookie");

describe("Player View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			SUBTITLES: "Subtitles",
			DETAILS: "Details",
		});
		useFetchJSON.mockReturnValue([{ path: "test.mp4" }, false, false]);
		useSessions.mockReturnValue([[], false, []]);
		useParentParams.mockReturnValue({
			group: "test",
			year: "2021",
			date: "01-01",
			name: "session",
		});
		Cookies.get.mockReturnValue("test");
	});

	it("renders audio player for audio files", () => {
		const { getByTestId } = render(
			<ContentSize.Provider value={mockSize}>
				<PlayerPage
					show={true}
					prefix="sessions"
					group="test"
					year="2021"
					date="01-01"
					name="session.m4a"
				/>
			</ContentSize.Provider>,
		);
		expect(getByTestId("audio")).toBeInTheDocument();
		expect(getByTestId("status-bar")).toBeInTheDocument();
	});

	it("renders video player for video files", () => {
		const { getByTestId } = render(
			<ContentSize.Provider value={mockSize}>
				<PlayerPage
					show={true}
					prefix="sessions"
					group="test"
					year="2021"
					date="01-01"
					name="session.mp4"
				/>
			</ContentSize.Provider>,
		);
		expect(getByTestId("video")).toBeInTheDocument();
	});
});
