import { MainStore } from "@components/Main";
import { ContentSize } from "@components/Page/Content";
import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useFetchJSON } from "@util/api/fetch";
import { useRecentHistory } from "@util/domain/history";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useParentParams } from "@util/domain/views";
import { exportFile } from "@util/storage/importExport";
import Cookies from "js-cookie";
import PlayerPage, { PlayerStore } from "./index";

jest.mock("@util/domain/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ speedToolbar: "bottom" }),
		update: jest.fn(),
	},
}));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/store", () => ({
	...jest.requireActual("@util/browser/store"),
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/api/fetch");
jest.mock("@util/domain/sessions");
jest.mock("@util/domain/views");
jest.mock("@util/domain/history", () => ({
	useRecentHistory: jest.fn().mockReturnValue([[], jest.fn(), false]),
}));
jest.mock("@util/storage/importExport", () => ({
	exportFile: jest.fn(),
}));
jest.mock("../Audio", () => ({ children, elements, ...props }: any) => (
	<div
		data-testid="audio"
		data-path={props.path}
		data-metadata={props.metadataKey}
	>
		{elements}
		{children}
	</div>
));
jest.mock("../Video", () => ({ children, ...props }: any) => (
	<div
		data-testid="video"
		data-path={props.path}
		data-metadata={props.metadataKey}
	>
		{children}
	</div>
));
jest.mock("../Transcript", () => () => <div data-testid="transcript" />);
jest.mock("../SpeedSlider", () => () => <div data-testid="speed-slider" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock(
	"@widgets/Download",
	() =>
		({ onClick, visible }: any) =>
			visible ? (
				<button type="button" data-testid="download" onClick={onClick}>
					download
				</button>
			) : null,
);
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("js-cookie");

describe("Player View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };
	let toolbarItems: any = [];

	const renderPlayer = (props = {}) =>
		render(
			<ContentSize.Provider value={mockSize}>
				<PlayerPage
					show={true}
					prefix="sessions"
					group="test"
					year="2021"
					date="01-01"
					name="session.mp4"
					{...props}
				/>
			</ContentSize.Provider>,
		);

	beforeEach(() => {
		jest.clearAllMocks();
		toolbarItems = [];
		asMock(useToolbar).mockImplementation(({ items }: any) => {
			toolbarItems = (items || []).filter(Boolean);
		});
		asMock(useTranslations).mockReturnValue({
			SUBTITLES: "Subtitles",
			SUBTITLES_OFF: "Subtitles off",
			DETAILS: "Details",
			REQUIRE_SIGNIN: "Please sign in",
			SESSION: "Session",
			SESSION_LOAD_ERROR:
				"We couldn't load this session. Please contact Zakai and mention: {session}.",
		});
		asMock(useFetchJSON).mockReturnValue([
			{
				path: "test.mp4",
				downloadUrl: "https://example.com/file.mp4",
				subtitles: "subs.vtt",
			},
			false,
			false,
			null,
			jest.fn(),
		]);
		asMock(useSessions).mockReturnValue([
			[],
			false,
			[{ name: "test", color: "#f00" }],
		]);
		asMock(useParentParams).mockReturnValue({
			group: "test",
			year: "2021",
			date: "01-01",
			name: "session",
		});
		asMock(Cookies.get).mockReturnValue("test");
		asMock(MainStore.useState).mockReturnValue({ speedToolbar: "bottom" });
		PlayerStore.update((state) => {
			Object.assign(state, {
				path: "",
				mediaPath: "",
				downloadUrl: "",
				subtitles: "",
				showSubtitles: true,
				showDetails: true,
				showSpeed: false,
				hash: "",
				message: "",
				severity: "info",
				session: null,
			});
		});
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

	it("waits for history to load before recording the current session", () => {
		const addToHistory = jest.fn();
		asMock(useRecentHistory).mockReturnValue([[], addToHistory, undefined]);

		const { rerender } = render(
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

		expect(addToHistory).not.toHaveBeenCalled();

		asMock(useRecentHistory).mockReturnValue([[], addToHistory, false]);
		rerender(
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

		expect(addToHistory).toHaveBeenCalledWith({
			group: "test",
			date: "01-01",
			name: "session.mp4",
		});
	});

	it("keeps the audio player mounted when subtitle metadata arrives", () => {
		const playerProps = {
			show: true,
			prefix: "sessions",
			group: "test",
			year: "2021",
			date: "01-01",
			name: "session.m4a",
		};
		const { getByTestId, rerender } = render(
			<ContentSize.Provider value={mockSize}>
				<PlayerPage {...playerProps} />
			</ContentSize.Provider>,
		);
		const audio = getByTestId("audio");

		asMock(useFetchJSON).mockReturnValue([
			{ path: "test.mp4", subtitles: "signed-subtitles.vtt" },
			false,
			false,
		]);
		rerender(
			<ContentSize.Provider value={mockSize}>
				<PlayerPage {...playerProps} />
			</ContentSize.Provider>,
		);

		expect(getByTestId("audio")).toBe(audio);
	});

	it("shows a reportable message when the session URL cannot be loaded", async () => {
		asMock(useFetchJSON).mockReturnValue([null, false, false, 403, jest.fn()]);

		renderPlayer();

		await waitFor(() =>
			expect(PlayerStore.getRawState()).toMatchObject({
				severity: "error",
				message:
					"We couldn't load this session. Please contact Zakai and mention: 01-01 session.mp4.",
			}),
		);
	});

	it("requires sign in when cookies are missing", async () => {
		asMock(Cookies.get).mockReturnValue(null);
		renderPlayer();
		await waitFor(() => {
			expect(PlayerStore.getRawState()).toMatchObject({
				mode: "signin",
				message: "Please sign in",
			});
		});
	});

	it("renders transcript inside audio for video transcript mode", () => {
		const { getByTestId, queryByTestId } = renderPlayer({
			mode: "transcript",
			name: "session.mp4",
		});
		expect(getByTestId("transcript")).toBeInTheDocument();
		expect(getByTestId("audio")).toBeInTheDocument();
		expect(queryByTestId("video")).not.toBeInTheDocument();
	});

	it("uses audio for video files in transcript mode", () => {
		const { getByTestId } = renderPlayer({
			mode: "transcript",
			name: "session.mp4",
		});
		expect(getByTestId("audio")).toBeInTheDocument();
	});

	it("uses bundled metadata key for bundled groups", async () => {
		asMock(useSessions).mockReturnValue([
			[],
			false,
			[{ name: "test", bundled: true, color: "#f00" }],
		]);
		const { getByTestId } = renderPlayer({ name: "session.mp4" });
		await waitFor(() => {
			expect(getByTestId("video")).toHaveAttribute(
				"data-metadata",
				"test/2021/01-01 session.json",
			);
		});
	});

	it("uses merged metadata key for merged groups", async () => {
		asMock(useSessions).mockReturnValue([
			[],
			false,
			[{ name: "test", merged: true, color: "#f00" }],
		]);
		const { getByTestId } = renderPlayer({ name: "session.mp4" });
		await waitFor(() => {
			expect(getByTestId("video")).toHaveAttribute(
				"data-metadata",
				"2021/01-01 session.json",
			);
		});
	});

	it("uses split metadata key for standard groups", async () => {
		asMock(useSessions).mockReturnValue([
			[],
			false,
			[{ name: "test", color: "#f00" }],
		]);
		const { getByTestId } = renderPlayer({ name: "session.mp4" });
		await waitFor(() => {
			expect(getByTestId("video")).toHaveAttribute(
				"data-metadata",
				"01-01 session.json",
			);
		});
	});

	it("registers toolbar items for subtitles and details on audio", async () => {
		renderPlayer({ name: "session.m4a" });
		await waitFor(() => {
			expect(toolbarItems.map((item) => item.id)).toEqual(
				expect.arrayContaining(["subtitles", "details"]),
			);
		});

		const subtitles: any = toolbarItems.find((item) => item.id === "subtitles");
		subtitles.onClick();
		expect(PlayerStore.getRawState().showSubtitles).toBe(false);

		const details: any = toolbarItems.find((item) => item.id === "details");
		details.onClick();
		expect(PlayerStore.getRawState().showDetails).toBe(false);
	});

	it("registers collapsed player toolbar item when hash is set", async () => {
		PlayerStore.update((s) => {
			s.hash = "#sessions/test";
			s.session = { group: "test", date: "01-01", name: "session.mp4" };
		});
		const originalHash = window.location.hash;
		window.location.hash = "";

		renderPlayer({ show: false });
		await waitFor(() => {
			expect(toolbarItems.some((item) => item.id === "player")).toBe(true);
		});
		const playerItem: any = toolbarItems.find((item) => item.id === "player");
		playerItem.onClick();
		expect(window.location.hash).toBe("#sessions/test");
		window.location.hash = originalHash;
	});

	it("shows speed slider at top when configured", () => {
		asMock(MainStore.useState).mockReturnValue({ speedToolbar: "top" });
		const { getByTestId } = renderPlayer();
		expect(getByTestId("speed-slider")).toBeInTheDocument();
	});

	it("exports download when download button is clicked", async () => {
		const { getByTestId } = renderPlayer();
		await waitFor(() => {
			expect(getByTestId("download")).toBeInTheDocument();
		});
		fireEvent.click(getByTestId("download"));
		expect(exportFile).toHaveBeenCalledWith(
			"https://example.com/file.mp4",
			expect.any(String),
		);
	});

	it("hides download in transcript mode", () => {
		const { queryByTestId } = renderPlayer({ mode: "transcript" });
		expect(queryByTestId("download")).not.toBeInTheDocument();
	});

	it("clears stale store data when path changes before fetch resolves", () => {
		asMock(useFetchJSON).mockReturnValue([null, false, true, null, jest.fn()]);
		PlayerStore.update((s) => {
			s.path = "sessions/old/path";
			s.mediaPath = "old.mp4";
			s.downloadUrl = "old-url";
		});
		renderPlayer({ group: "other", name: "new.mp4" });
		expect(PlayerStore.getRawState()).toMatchObject({
			path: expect.stringContaining("other"),
			mediaPath: "",
			downloadUrl: "",
		});
	});

	it("stores hash when player becomes visible", () => {
		const originalHash = window.location.hash;
		window.location.hash = "#sessions/test";
		renderPlayer({ show: true });
		expect(PlayerStore.getRawState().hash).toBe("#sessions/test");
		window.location.hash = originalHash;
	});

	it("updates player store when fetch data arrives", async () => {
		renderPlayer();
		await waitFor(() => {
			expect(PlayerStore.getRawState()).toMatchObject({
				mediaPath: "test.mp4",
				downloadUrl: "https://example.com/file.mp4",
				subtitles: "subs.vtt",
			});
		});
	});

	it("hides player content when show is false", () => {
		const { container } = renderPlayer({ show: false });
		expect(
			container.querySelector('[style*="visibility: hidden"]'),
		).toBeTruthy();
	});

	it("shows speed slider when showSpeed is enabled", () => {
		PlayerStore.update((s) => {
			s.showSpeed = true;
		});
		const { getByTestId } = renderPlayer({ name: "session.m4a" });
		expect(getByTestId("speed-slider")).toBeInTheDocument();
	});

	it("renders transcript-only view for audio transcript mode", () => {
		const { getByTestId, queryByTestId } = renderPlayer({
			mode: "transcript",
			name: "session.m4a",
		});
		expect(getByTestId("transcript")).toBeInTheDocument();
		expect(queryByTestId("video")).not.toBeInTheDocument();
	});

	it("skips download when no download url is available", () => {
		asMock(useFetchJSON).mockReturnValue([
			{ path: "test.mp4", downloadUrl: "", subtitles: "" },
			false,
			false,
			null,
			jest.fn(),
		]);
		const { queryByTestId } = renderPlayer({ name: "session.m4a" });
		expect(queryByTestId("download")).not.toBeInTheDocument();
	});

	it("renders subtitle tracks for video playback", async () => {
		asMock(useFetchJSON).mockReturnValue([
			{
				path: "/media/video.mp4",
				subtitles: "/media/subs.vtt",
				downloadUrl: "/media/video.mp4",
			},
			jest.fn(),
			false,
			null,
			jest.fn(),
		]);
		PlayerStore.update((s) => {
			s.showSubtitles = true;
		});
		const { container } = renderPlayer({ name: "session.mp4" });
		await waitFor(() => {
			expect(container.querySelector("track")).toBeTruthy();
		});
	});

	it("shows speed slider at the top when configured in MainStore", () => {
		const { MainStore } = require("@components/Main");
		asMock(MainStore.useState).mockReturnValue({ speedToolbar: "top" });
		PlayerStore.update((s) => {
			s.showSpeed = true;
		});
		const { getByTestId } = renderPlayer({ name: "session.m4a" });
		expect(getByTestId("speed-slider")).toBeInTheDocument();
	});

	it("omits metadata keys while player data is still loading", () => {
		asMock(useFetchJSON).mockReturnValue([
			null,
			jest.fn(),
			true,
			null,
			jest.fn(),
		]);
		const { getByTestId } = renderPlayer({ name: "session.m4a" });
		expect(getByTestId("audio").getAttribute("data-metadata")).toBeNull();
	});
});
