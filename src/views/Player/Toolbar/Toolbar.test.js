import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { PlayerStore } from "../Player/index.js";
import Toolbar from "./index.js";

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
	let mockPlayer;

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			SPEED: "Speed",
			FULLSCREEN: "Fullscreen",
		});
		useDeviceType.mockReturnValue("desktop");
		mockPlayer = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			playbackRate: 1.0,
			requestFullscreen: jest.fn(),
		};
		PlayerStore.useState.mockReturnValue({ showSpeed: false });
	});

	it("calls useToolbar on render", () => {
		render(<Toolbar show={true} playerRef={mockPlayer} isVideo={true} />);
		const { useToolbar } = require("@components/Toolbar");
		expect(useToolbar).toHaveBeenCalled();
	});
});
