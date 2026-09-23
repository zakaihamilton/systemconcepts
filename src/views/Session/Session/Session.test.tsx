import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFetch } from "@util/api/fetch";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { copyToClipboard } from "@util/data/string";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { addPath, replacePath } from "@util/domain/views";
import SessionPage from "./Session";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn().mockReturnValue({ order: "desc", orderBy: "date" }),
	},
}));
jest.mock("@util/api/fetch");
jest.mock("@util/browser/styles");
jest.mock("@util/browser/touch", () => ({
	useSwipe: jest.fn(() => ({})),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: () => ({ format: () => "Monday" }),
}));
jest.mock("@util/data/string", () => ({
	copyToClipboard: jest.fn(() => true),
	formatDuration: jest.fn(() => "1:00"),
}));
jest.mock("@util/data/color", () => ({
	getContrastColor: jest.fn(() => "#fff"),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	replacePath: jest.fn(),
}));
jest.mock("@widgets/Group", () => () => <div data-testid="group" />);
jest.mock("@widgets/Summary", () => () => <div data-testid="summary" />);
jest.mock("@widgets/Image", () => ({ path, onClick }: any) => (
	<button type="button" data-testid="image" data-path={path} onClick={onClick}>
		img
	</button>
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@ui/Chip", () => ({ label, onClick }: any) => (
	<button type="button" onClick={onClick}>
		{label}
	</button>
));
jest.mock(
	"@ui/Snackbar",
	() =>
		({ open, children, onClose }: any) =>
			open ? (
				<div data-testid="snackbar">
					<button type="button" onClick={onClose}>
						close-snack
					</button>
					{children}
				</div>
			) : null,
);
jest.mock("@ui/Alert", () => ({ children }: any) => <div>{children}</div>);

const baseSession = {
	group: "test",
	year: "2024",
	date: "2024-05-05",
	name: "Test Session",
	color: "#ff0000",
	duration: 3600,
	position: 10,
	tags: ["'Grace'", "Peace"],
	summaryText: "# Summary",
	summary: { path: "summary.md" },
	image: { path: "/aws/sessions/test/2024/x.png" },
};

describe("Session View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			NOT_FOUND: "Not Found",
			PREVIOUS: "Previous",
			NEXT: "Next",
			DOWNLOAD: "Download",
			COPIED_TO_CLIPBOARD: "Copied",
		});
		useDeviceType.mockReturnValue("desktop");
		useSessions.mockReturnValue([[], true]);
		useFetch.mockReturnValue([null, null, false]);
		useSwipe.mockReturnValue({});
		URL.createObjectURL = jest.fn(() => "blob:1");
		URL.revokeObjectURL = jest.fn();
	});

	it("renders loading state", () => {
		render(<SessionPage />);
		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("renders not found state if session missing", () => {
		useSessions.mockReturnValue([[], false]);
		render(<SessionPage />);
		expect(screen.getByText("Not Found")).toBeInTheDocument();
	});

	it("renders session details when available", () => {
		useSessions.mockReturnValue([[baseSession], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		expect(screen.getByText("Test Session")).toBeInTheDocument();
		expect(screen.getByTestId("group")).toBeInTheDocument();
		expect(screen.getByTestId("summary")).toBeInTheDocument();
	});

	it("uses the authenticated AWS image path", () => {
		const mockSession = {
			...baseSession,
			group: "will",
			year: "2026",
			date: "2026-06-30",
			name: "Beastly",
			imagePath: "https://cdn.example/stale.png",
			image: { path: "/aws/sessions/will/2026/2026-06-30 Beastly.png" },
		};
		useSessions.mockReturnValue([[mockSession], false]);
		render(
			<SessionPage group="will" year="2026" date="2026-06-30" name="Beastly" />,
		);
		expect(screen.getByTestId("image")).toHaveAttribute(
			"data-path",
			"/aws/sessions/will/2026/2026-06-30 Beastly.png",
		);
	});

	it("normalizes legacy CDN image URLs to the Wasabi storage path", () => {
		const mockSession = {
			...baseSession,
			group: "american",
			year: "2026",
			date: "2026-08-20",
			name: "Breath, Sound, and Speech",
			image: {
				path: "https://screens.sfo2.digitaloceanspaces.com/wasabi/american/2026/2026-08-20%20Breath,%20Sound,%20and%20Speech.png",
			},
			imagePath:
				"https://screens.sfo2.digitaloceanspaces.com/wasabi/american/2026/2026-08-20%20Breath,%20Sound,%20and%20Speech.png",
		};
		useSessions.mockReturnValue([[mockSession], false]);

		render(
			<SessionPage
				group="american"
				year="2026"
				date="2026-08-20"
				name="Breath, Sound, and Speech"
			/>,
		);

		expect(screen.getByTestId("image")).toHaveAttribute(
			"data-path",
			"wasabi/american/2026/2026-08-20 Breath, Sound, and Speech.png",
		);
	});

	it("copies title and tags to clipboard", () => {
		useSessions.mockReturnValue([[baseSession], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		fireEvent.click(screen.getByText("Test Session"));
		expect(copyToClipboard).toHaveBeenCalledWith("2024-05-05 Test Session");
		expect(screen.getByTestId("snackbar")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Grace"));
		expect(copyToClipboard).toHaveBeenCalledWith("Grace");
		fireEvent.click(screen.getByText("close-snack"));
	});

	it("opens image path and downloads summary via toolbar", () => {
		useSessions.mockReturnValue([[baseSession], false]);
		const anchor = { click: jest.fn(), href: "", download: "" };
		const originalCreateElement = document.createElement.bind(document);
		jest.spyOn(document, "createElement").mockImplementation((tag, ...rest) => {
			if (tag === "a") return anchor;
			return originalCreateElement(tag, ...rest);
		});
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		fireEvent.click(screen.getByTestId("image"));
		expect(addPath).toHaveBeenCalledWith("image");

		const download = useToolbar.mock.calls
			.at(-1)[0]
			.items.find((i: any) => i.id === "download");
		download.onClick();
		expect(URL.createObjectURL).toHaveBeenCalled();
		expect(anchor.click).toHaveBeenCalled();
		document.createElement.mockRestore();
	});

	it("navigates prev/next and wires swipe handlers", () => {
		const sessions = [
			{ ...baseSession, name: "A", date: "2024-05-04" },
			baseSession,
			{ ...baseSession, name: "C", date: "2024-05-06" },
		];
		useSessions.mockImplementation((_init: any, opts = {}) => {
			if (opts.filterSessions) return [sessions, false];
			return [sessions, false];
		});
		let swipeArgs;
		useSwipe.mockImplementation((args: any) => {
			swipeArgs = args;
			return { "data-swipe": "1" };
		});
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		const items = useToolbar.mock.calls.at(-1)[0].items;
		items.find((i: any) => i.id === "prevSession").onClick();
		items.find((i: any) => i.id === "nextSession").onClick();
		expect(replacePath).toHaveBeenCalled();
		swipeArgs.onSwipeLeft();
		swipeArgs.onSwipeRight();
		expect(replacePath.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it("hides summary for image type and uses wasabi path", () => {
		const session = {
			...baseSession,
			type: "image",
			duration: 0,
			tags: [],
			image: { path: "wasabi/x.jpg" },
		};
		useSessions.mockReturnValue([[session], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		expect(screen.queryByTestId("summary")).not.toBeInTheDocument();
		fireEvent.click(screen.getByTestId("image"));
		expect(addPath).toHaveBeenCalledWith("image?ext=jpg");
	});

	it("fetches summary when summaryText missing", async () => {
		const session = { ...baseSession, summaryText: undefined };
		useSessions.mockReturnValue([[session], false]);
		useFetch.mockReturnValue(["fetched", null, false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("summary")).toBeInTheDocument(),
		);
	});

	it("uses imagePath fallback and mobile toolbar without prev/next", () => {
		useDeviceType.mockReturnValue("phone");
		const session = {
			...baseSession,
			image: undefined,
			imagePath: "local/path.png",
			thumbnail: "thumb.png",
		};
		useSessions.mockReturnValue([[session], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		const items = useToolbar.mock.calls.at(-1)[0].items.filter(Boolean);
		expect(items.find((i: any) => i.id === "prevSession")).toBeUndefined();
		expect(screen.getByTestId("image")).toHaveAttribute(
			"data-path",
			"local/path.png",
		);
	});

	it("uses thumbnail string when image object is missing", () => {
		const session = {
			...baseSession,
			image: undefined,
			imagePath: undefined,
			thumbnail: "thumb/path.jpg",
		};
		useSessions.mockReturnValue([[session], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		expect(screen.getByTestId("image")).toHaveAttribute(
			"data-path",
			"thumb/path.jpg",
		);
		fireEvent.click(screen.getByTestId("image"));
		expect(addPath).toHaveBeenCalledWith("image?ext=jpg");
	});

	it("skips image navigation for data-uri thumbnails", () => {
		const session = {
			...baseSession,
			image: undefined,
			imagePath: undefined,
			thumbnail: "data:image/png;base64,abc",
		};
		useSessions.mockReturnValue([[session], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		fireEvent.click(screen.getByTestId("image"));
		expect(addPath).not.toHaveBeenCalled();
	});

	it("handles null filtered sessions while loading completes", () => {
		useSessions.mockImplementation((_init: any, opts = {}) => {
			if (opts.filterSessions) return [null, false];
			return [[baseSession], false];
		});
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		expect(screen.getByText("Test Session")).toBeInTheDocument();
	});

	it("copies a cleaned tag label and shows snackbar feedback", async () => {
		const { copyToClipboard } = require("@util/data/string");
		useSessions.mockReturnValue([[baseSession], false]);
		render(
			<SessionPage
				group="test"
				year="2024"
				date="2024-05-05"
				name="Test Session"
			/>,
		);
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Grace" })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: "Grace" }));
		expect(copyToClipboard).toHaveBeenCalledWith("Grace");
		expect(screen.getByTestId("snackbar")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "close-snack" }));
		expect(screen.queryByTestId("snackbar")).not.toBeInTheDocument();
	});
});
