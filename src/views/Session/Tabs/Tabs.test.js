import { render } from "@testing-library/react";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useParentParams, usePathItems } from "@util/domain/views";
import Tabs from "./index.js";

jest.mock("@components/Widgets/Tabs/Tab", () => ({ label, value }) => (
	<div data-value={value}>{label}</div>
));
jest.mock("@icons/Audio", () => () => <span />);
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
}));
jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({
	toPath: (...items) => items.map(encodeURIComponent).join("/"),
	useParentParams: jest.fn(),
	usePathItems: jest.fn(),
}));

describe("Session Tabs", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			DETAILS: "Details",
			AUDIO: "Audio",
			VIDEO: "Video",
			THUMBNAIL: "Thumbnail",
			IMAGE: "Image",
			TRANSCRIPT: "Transcript",
		});
		usePathItems.mockReturnValue([
			"session?group=test&year=2024&date=2024-05-05&name=Test Session",
		]);
		useParentParams.mockReturnValue({
			group: "test",
			year: "2024",
			date: "2024-05-05",
			name: "Test Session",
		});
	});

	it("shows transcript tab when a transcript path is present", () => {
		useSessions.mockReturnValue([
			[
				{
					group: "test",
					year: "2024",
					date: "2024-05-05",
					name: "Test Session",
					video: { path: "wasabi/test/2024/2024-05-05 Test Session.mp4" },
					transcriptPath: "wasabi/test/2024/2024-05-05 Test Session.txt",
				},
			],
		]);

		const { getByText } = render(
			<Tabs Container={({ children }) => children} />,
		);

		expect(getByText("Transcript")).toBeInTheDocument();
	});

	it("shows transcript tab when transcript files are present", () => {
		useSessions.mockReturnValue([
			[
				{
					group: "test",
					year: "2024",
					date: "2024-05-05",
					name: "Test Session",
					video: { path: "wasabi/test/2024/2024-05-05 Test Session.mp4" },
					files: ["2024-05-05 Test Session.mp4", "2024-05-05 Test Session.txt"],
				},
			],
		]);

		const { getByText } = render(
			<Tabs Container={({ children }) => children} />,
		);

		expect(getByText("Transcript")).toBeInTheDocument();
	});

	it("shows transcript tab for media sessions so the player can resolve inferred transcripts", () => {
		useSessions.mockReturnValue([
			[
				{
					group: "test",
					year: "2024",
					date: "2024-05-05",
					name: "Test Session",
					video: { path: "wasabi/test/2024/2024-05-05 Test Session.mp4" },
				},
			],
		]);

		const { getByText } = render(
			<Tabs Container={({ children }) => children} />,
		);

		expect(getByText("Transcript")).toBeInTheDocument();
	});
});
