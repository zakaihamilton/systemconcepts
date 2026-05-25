import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import SessionIcon from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@components/Icons/Audio", () => () => (
	<div data-testid="audio-icon" />
));

describe("SessionIcon Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ VIDEO: "Video", AUDIO: "Audio" });
	});

	it("renders correct icon for video", () => {
		const { container } = render(<SessionIcon type="video" />);
		expect(container.querySelector("svg")).toBeInTheDocument();
	});

	it("renders correct icon for audio", () => {
		const { getByTestId } = render(<SessionIcon type="audio" />);
		expect(getByTestId("audio-icon")).toBeInTheDocument();
	});

	it("renders nothing for unknown type", () => {
		const { container } = render(<SessionIcon type="" />);
		expect(container.firstChild).toBeNull();
	});
});
