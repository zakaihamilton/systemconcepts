import { useSearch } from "@components/Search";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useFetch } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { PlayerStore } from "../Player/index.js";
import Transcript from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("../Player", () => ({
	PlayerStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/api/fetch");
jest.mock("@components/Search");
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("@widgets/Download", () => () => <div data-testid="download" />);

describe("Transcript Component", () => {
	let mockPlayer;

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			MATCHES: "{current} of {total}",
			CLOSE: "Close",
			DOWNLOAD_TRANSCRIPT: "Download",
		});
		mockPlayer = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			currentTime: 0,
			play: jest.fn(),
		};
		PlayerStore.useState.mockReturnValue({
			subtitles: "test.vtt",
			transcriptionUrl: "",
			player: mockPlayer,
		});
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello World",
			false,
			false,
		]);
		useSearch.mockReturnValue("");

		// Mock portal target
		const portal = document.createElement("div");
		portal.id = "search-status-portal";
		document.body.appendChild(portal);
	});

	afterEach(() => {
		const portal = document.getElementById("search-status-portal");
		if (portal) document.body.removeChild(portal);
	});

	it("renders transcript lines", async () => {
		const { getByText } = render(<Transcript show={true} />);
		await waitFor(() => {
			expect(getByText("Hello World")).toBeInTheDocument();
			expect(getByText("0:01")).toBeInTheDocument();
		});
	});

	it("calls player.currentTime and play when a line is clicked", async () => {
		const { getByText } = render(<Transcript show={true} />);
		await waitFor(() => {
			fireEvent.click(getByText("Hello World"));
			expect(mockPlayer.currentTime).toBe(1);
			expect(mockPlayer.play).toHaveBeenCalled();
		});
	});

	it("renders plain text transcripts without timestamps", async () => {
		PlayerStore.useState.mockReturnValue({
			subtitles: "",
			transcriptionUrl: "test.txt",
			player: mockPlayer,
		});
		useFetch.mockReturnValue(["A transcript without timecodes", false, false]);

		const { getByText } = render(<Transcript show={true} />);
		await waitFor(() => {
			expect(getByText("A transcript without timecodes")).toBeInTheDocument();
			expect(getByText("0:00")).toBeInTheDocument();
		});
	});
});
