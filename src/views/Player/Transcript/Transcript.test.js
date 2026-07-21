import { useSearch } from "@components/Search";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
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
jest.mock(
	"@widgets/Download",
	() =>
		({ onClick, visible, title }) =>
			visible ? (
				<button
					type="button"
					data-testid="download"
					title={title}
					onClick={onClick}
				>
					Download
				</button>
			) : null,
);
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<span title={title}>{children}</span>
));

describe("Transcript Component", () => {
	let mockPlayer;
	let timeupdateCb;

	beforeEach(() => {
		jest.clearAllMocks();
		timeupdateCb = null;
		useTranslations.mockReturnValue({
			MATCHES: "{current} of {total}",
			CLOSE: "Close",
			DOWNLOAD_TRANSCRIPT: "Download",
			PREVIOUS_MATCH: "Previous",
			NEXT_MATCH: "Next",
		});
		mockPlayer = {
			addEventListener: jest.fn((event, cb) => {
				if (event === "timeupdate") timeupdateCb = cb;
			}),
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

		const portal = document.createElement("div");
		portal.id = "search-status-portal";
		document.body.appendChild(portal);

		Element.prototype.scrollIntoView = jest.fn();
		window.URL.createObjectURL = jest.fn(() => "blob:url");
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

	it("shows loading progress", () => {
		useFetch.mockReturnValue([null, false, true]);
		render(<Transcript show />);
		expect(screen.getByTestId("progress")).toBeInTheDocument();
	});

	it("clears transcript when data is empty", async () => {
		useFetch.mockReturnValue([null, false, false]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.queryByText("Hello World")).not.toBeInTheDocument();
		});
	});

	it("parses VTT cues with numeric index lines", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n1\n00:01:05.000 --> 00:01:10.000\nHour line\n\n2\n00:00:02.000 --> 00:00:03.000\nSecond",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Hour line")).toBeInTheDocument();
			expect(screen.getByText("1:05")).toBeInTheDocument();
		});
	});

	it("parses TXT transcripts with bracket timestamps", async () => {
		PlayerStore.useState.mockReturnValue({
			subtitles: "",
			transcriptionUrl: "notes.txt",
			player: mockPlayer,
		});
		useFetch.mockReturnValue([
			"[00:00:01] First line\n[00:00:05] Second line",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("First line")).toBeInTheDocument();
			expect(screen.getByText("Second line")).toBeInTheDocument();
		});
	});

	it("highlights search matches and navigates between them", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello World\n\n00:00:06.000 --> 00:00:09.000\nHello again",
			false,
			false,
		]);
		useSearch.mockImplementation((name, _cb, _show, opts) => {
			if (opts?.onEnter) {
				// expose for later if needed
			}
			return "Hello";
		});
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("1 of 2")).toBeInTheDocument();
		});

		const buttons = screen.getAllByRole("button");
		const next = buttons.find((btn) =>
			btn.parentElement?.getAttribute("title")?.startsWith("Next"),
		);
		const prev = buttons.find((btn) =>
			btn.parentElement?.getAttribute("title")?.startsWith("Previous"),
		);
		fireEvent.click(next);
		expect(screen.getByText("2 of 2")).toBeInTheDocument();
		fireEvent.click(prev);
		expect(screen.getByText("1 of 2")).toBeInTheDocument();

		const close = buttons.find(
			(btn) => btn.parentElement?.getAttribute("title") === "Close",
		);
		fireEvent.click(close);
		expect(screen.queryByText("1 of 2")).not.toBeInTheDocument();
	});

	it("hides match header when search has no hits", async () => {
		useSearch.mockReturnValue("zzzz");
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Hello World")).toBeInTheDocument();
		});
		expect(screen.queryByText(/of/)).not.toBeInTheDocument();
	});

	it("updates current line on player timeupdate and scrolls", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello World\n\n00:00:06.000 --> 00:00:09.000\nNext",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Hello World")).toBeInTheDocument();
		});
		mockPlayer.currentTime = 2;
		act(() => {
			timeupdateCb();
		});
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
	});

	it("downloads transcript and appends extension when missing", async () => {
		PlayerStore.useState.mockReturnValue({
			subtitles: "",
			transcriptionUrl: "https://cdn.example/path/file?token=1",
			player: mockPlayer,
		});
		useFetch.mockReturnValue(["plain body", false, false]);
		const clickSpy = jest
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByTestId("download")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("download"));
		expect(window.URL.createObjectURL).toHaveBeenCalled();
		expect(clickSpy).toHaveBeenCalled();
		clickSpy.mockRestore();
	});

	it("downloads vtt without rewriting existing extension", async () => {
		PlayerStore.useState.mockReturnValue({
			subtitles: "https://cdn.example/cap.vtt",
			transcriptionUrl: "",
			player: mockPlayer,
		});
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello",
			false,
			false,
		]);
		const clickSpy = jest
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByTestId("download")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId("download"));
		expect(clickSpy).toHaveBeenCalled();
		clickSpy.mockRestore();
	});

	it("skips player listeners when player is missing", async () => {
		PlayerStore.useState.mockReturnValue({
			subtitles: "test.vtt",
			transcriptionUrl: "",
			player: null,
		});
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Hello World")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByText("Hello World"));
	});

	it("ignores invalid VTT blocks", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\nbadblock\n\n00:00:01.000 --> 00:00:02.000\nOk",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Ok")).toBeInTheDocument();
		});
		expect(screen.queryByText("badblock")).not.toBeInTheDocument();
	});

	it("opens search header via onEnter callback", async () => {
		let onEnter;
		useSearch.mockImplementation((_name, _cb, _show, opts) => {
			onEnter = opts?.onEnter;
			return "Hello";
		});
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello World",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("1 of 1")).toBeInTheDocument();
		});
		act(() => {
			onEnter?.();
		});
		expect(screen.getByText("1 of 1")).toBeInTheDocument();
	});

	it("formats multi-hour timestamps", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n01:02:03.000 --> 01:02:10.000\nLong cue",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("1:02:03")).toBeInTheDocument();
		});
	});

	it("highlights non-current matches in the same line", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nhello hello",
			false,
			false,
		]);
		useSearch.mockReturnValue("hello");
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("1 of 2")).toBeInTheDocument();
		});
		expect(screen.getAllByText("hello").length).toBe(2);
	});

	it("parses VTT cues with missing start timestamps as zero", async () => {
		useFetch.mockReturnValue([
			"WEBVTT\n\n --> 00:00:02.000\nMissing start",
			false,
			false,
		]);
		render(<Transcript show />);
		await waitFor(() => {
			expect(screen.getByText("Missing start")).toBeInTheDocument();
			expect(screen.getByText("0:00")).toBeInTheDocument();
		});
	});
});
