import { render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import { PlayerStore } from "./Player";
import SpeedSlider from "./SpeedSlider";

jest.mock("@util/translations");
jest.mock("./Player", () => ({
	PlayerStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ speedToolbar: "bottom" }),
	},
}));
jest.mock("@mui/material/Slider", () => ({ valueLabelFormat, valueLabelDisplay, step, marks, ...props }) => (
	<div data-testid="slider" {...props} />
));

describe("SpeedSlider Component", () => {
	let mockPlayer;

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ SPEED: "Speed" });
		mockPlayer = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			playbackRate: 1.0,
		};
		PlayerStore.useState.mockReturnValue({
			player: mockPlayer,
			showSpeed: true,
		});
	});

	it("renders slider when showSpeed is true and player exists", () => {
		const { getByTestId } = render(<SpeedSlider />);
		expect(getByTestId("slider")).toBeInTheDocument();
	});

	it("renders nothing when showSpeed is false", () => {
		PlayerStore.useState.mockReturnValue({
			player: mockPlayer,
			showSpeed: false,
		});
		const { queryByTestId } = render(<SpeedSlider />);
		expect(queryByTestId("slider")).not.toBeInTheDocument();
	});
});
