import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { PlayerStore } from "../Store";
import SpeedSlider from "./index";

jest.mock("@util/domain/translations");
jest.mock("../Store", () => ({
	PlayerStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@components/Main/MainStore", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ speedToolbar: "bottom" }),
	},
}));
jest.mock(
	"@ui/Slider",
	() =>
		({ valueLabelFormat, valueLabelDisplay, step, marks, ...props }: any) => (
			<div data-testid="slider" {...props} />
		),
);

describe("SpeedSlider Component", () => {
	let mockPlayer: any;

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

	it("does not repeat an intermediate speed without a descriptive label", () => {
		mockPlayer.playbackRate = 1.35;
		const { getAllByText } = render(<SpeedSlider />);

		expect(getAllByText("1.35×")).toHaveLength(1);
	});
});
