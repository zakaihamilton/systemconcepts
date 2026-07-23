import { act, fireEvent, render } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import { useDeviceType } from "@util/browser/styles";
import { useDateFormatter } from "@util/data/locale";
import { PlayerStore } from "../Player";
import Audio from "./index.js";

jest.mock("../Controls", () => () => <div data-testid="controls" />);
jest.mock("../Toolbar", () => () => <div data-testid="toolbar" />);
jest.mock("../Player", () => ({
	PlayerStore: {
		update: jest.fn(),
	},
}));
jest.mock("@components/Widgets/Group", () => () => <div data-testid="group" />);
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest
		.fn()
		.mockReturnValue({ format: jest.fn().mockReturnValue("Formatted Date") }),
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock("@util/browser/styles");

describe("Audio Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		useDateFormatter.mockReturnValue({
			format: jest.fn().mockReturnValue("Formatted Date"),
		});
		jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
	});

	afterEach(() => {
		if (HTMLMediaElement.prototype.load.mockRestore) {
			HTMLMediaElement.prototype.load.mockRestore();
		}
	});

	it("renders audio player container and sub-components", () => {
		const { getByTestId, getByText } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
			/>,
		);
		expect(getByText("Test Audio")).toBeInTheDocument();
		expect(getByTestId("group")).toBeInTheDocument();
		expect(getByTestId("controls")).toBeInTheDocument();
		expect(getByTestId("toolbar")).toBeInTheDocument();
	});

	it("applies loading class when renewing is true", () => {
		const { container } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
				renewing={true}
			/>,
		);
		const card = container.querySelector(".card");
		expect(card).toHaveClass("loading");
	});

	it("loads the media when its source path becomes available", () => {
		const loadSpy = HTMLMediaElement.prototype.load;
		loadSpy.mockClear();

		render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a"
			/>,
		);

		expect(loadSpy).toHaveBeenCalledTimes(1);
	});

	it("renews the url on media errors and reports a load failure after three attempts", () => {
		const renewUrl = jest.fn();
		const onLoadError = jest.fn();
		const { container, rerender } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a?sig=1"
				renewUrl={renewUrl}
				onLoadError={onLoadError}
			/>,
		);
		const video = container.querySelector("video");

		fireEvent.error(video);
		// Simulate a renewed signed URL arriving between attempts.
		rerender(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a?sig=2"
				renewUrl={renewUrl}
				onLoadError={onLoadError}
			/>,
		);
		fireEvent.error(video);
		rerender(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a?sig=3"
				renewUrl={renewUrl}
				onLoadError={onLoadError}
			/>,
		);
		fireEvent.error(video);
		rerender(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a?sig=4"
				renewUrl={renewUrl}
				onLoadError={onLoadError}
			/>,
		);
		fireEvent.error(video);

		expect(renewUrl).toHaveBeenCalledTimes(3);
		expect(onLoadError).toHaveBeenCalledTimes(1);
	});

	it("ignores duplicate errors while a renew is already in flight", () => {
		const renewUrl = jest.fn();
		const { container } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a"
				renewUrl={renewUrl}
			/>,
		);
		const video = container.querySelector("video");

		fireEvent.error(video);
		fireEvent.error(video);
		fireEvent.error(video);

		expect(renewUrl).toHaveBeenCalledTimes(1);
	});

	it("clears recovery state after metadata loads", () => {
		const renewUrl = jest.fn();
		const { container } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a"
				sessionKey="session-a"
				renewUrl={renewUrl}
			/>,
		);
		const video = container.querySelector("video");

		fireEvent.error(video);
		fireEvent.loadedMetadata(video);

		fireEvent.error(video);
		expect(renewUrl).toHaveBeenCalledTimes(2);
	});

	it("clears recovering when a renew fetch finishes without a new URL", () => {
		const renewUrl = jest.fn();
		const { container, rerender } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
				path="https://media.example/test.m4a?sig=1"
				sessionKey="session-a"
				renewUrl={renewUrl}
				renewing={false}
			/>,
		);
		const video = container.querySelector("video");
		Object.defineProperty(video, "duration", {
			configurable: true,
			value: 125,
		});
		act(() => {
			fireEvent.durationChange(video);
		});

		fireEvent.error(video);
		expect(container.querySelector(".card")).toHaveClass("loading");

		rerender(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
				path="https://media.example/test.m4a?sig=1"
				sessionKey="session-a"
				renewUrl={renewUrl}
				renewing={true}
			/>,
		);
		rerender(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
				path="https://media.example/test.m4a?sig=1"
				sessionKey="session-a"
				renewUrl={renewUrl}
				renewing={false}
			/>,
		);

		expect(container.querySelector(".card")).not.toHaveClass("loading");
	});

	it("updates PlayerStore with the media element reference", () => {
		render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				path="https://media.example/test.m4a"
			/>,
		);
		expect(PlayerStore.update).toHaveBeenCalled();
	});

	it("shows duration after metadata is available", () => {
		const { container } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				date="2021-01-01"
				path="https://media.example/test.m4a"
			/>,
		);
		const video = container.querySelector("video");
		Object.defineProperty(video, "duration", {
			configurable: true,
			value: 125,
		});

		act(() => {
			fireEvent.durationChange(video);
		});

		expect(container.textContent).toMatch(/2:0?5/);
	});

	it("enables the first text track when children are provided", () => {
		const track = { mode: "disabled" };
		const textTracks = [track];
		jest
			.spyOn(HTMLVideoElement.prototype, "textTracks", "get")
			.mockReturnValue(textTracks);

		render(
			<Audio show={true} name="Test Audio" group="testgroup">
				<track kind="captions" />
			</Audio>,
		);

		expect(track.mode).toBe("showing");
	});

	it("logs when date formatting fails", () => {
		useDateFormatter.mockReturnValue({
			format: jest.fn(() => {
				throw new Error("bad date");
			}),
		});

		render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				date="not-a-date"
			/>,
		);

		expect(structuredLogger.error).toHaveBeenCalledWith(
			"err",
			expect.any(Error),
		);
	});

	it("uses short month formatting on mobile and hides video for transcripts", () => {
		useDeviceType.mockReturnValue("mobile");
		const { container } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				date="2021-01-01"
				isTranscript={true}
				showDetails={false}
				elements={<div data-testid="extra" />}
			/>,
		);

		expect(useDateFormatter).toHaveBeenCalledWith(
			expect.objectContaining({ month: "short" }),
		);
		expect(container.querySelector(".hidden")).toBeTruthy();
		expect(container.querySelector('[data-testid="extra"]')).toBeTruthy();
	});
});
