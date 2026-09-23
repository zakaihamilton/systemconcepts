import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { PlayerStore } from "../Player/index";
import Toolbar from "./index";

jest.mock("@util/domain/translations");
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/styles");
jest.mock("../Player", () => ({
	PlayerStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));

describe("Toolbar Component", () => {
	let mockPlayer: any;

	beforeEach(() => {
		jest.clearAllMocks();
		asMock(useTranslations).mockReturnValue({
			SPEED: "Speed",
			FULLSCREEN: "Fullscreen",
		});
		asMock(useDeviceType).mockReturnValue("desktop");
		mockPlayer = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			playbackRate: 1.0,
			requestFullscreen: jest.fn(),
		};
		asMock(PlayerStore.useState).mockReturnValue({ showSpeed: false });
	});

	it("calls useToolbar on render", () => {
		render(<Toolbar show={true} playerRef={mockPlayer} isVideo={true} />);
		const { useToolbar } = require("@components/Toolbar");
		expect(useToolbar).toHaveBeenCalled();
	});
});
