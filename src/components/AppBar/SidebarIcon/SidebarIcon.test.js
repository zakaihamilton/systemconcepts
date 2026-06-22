import { fireEvent, render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { MainStore } from "../../Main";
import SidebarIcon from "./SidebarIcon.js";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");

describe("SidebarIcon Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		MainStore.update((s) => {
			s.showSlider = false;
			s.showSideBar = false;
		});
	});

	it("renders SidebarIcon with translations", () => {
		useTranslations.mockReturnValue({ SIDEBAR: "Sidebar Option" });
		useDeviceType.mockReturnValue("desktop");

		const { getByLabelText } = render(<SidebarIcon />);
		const button = getByLabelText("Sidebar Option");
		expect(button).toBeInTheDocument();
	});

	it("toggles showSideBar on desktop click", () => {
		useTranslations.mockReturnValue({ SIDEBAR: "Sidebar" });
		useDeviceType.mockReturnValue("desktop");

		const { getByLabelText } = render(<SidebarIcon />);
		const button = getByLabelText("Sidebar");

		expect(MainStore.getRawState().showSideBar).toBe(false);
		fireEvent.click(button);
		expect(MainStore.getRawState().showSideBar).toBe(true);

		fireEvent.click(button);
		expect(MainStore.getRawState().showSideBar).toBe(false);
	});

	it("toggles showSlider on mobile click", () => {
		useTranslations.mockReturnValue({ SIDEBAR: "Sidebar" });
		useDeviceType.mockReturnValue("phone");

		const { getByLabelText } = render(<SidebarIcon />);
		const button = getByLabelText("Sidebar");

		expect(MainStore.getRawState().showSlider).toBe(false);
		fireEvent.click(button);
		expect(MainStore.getRawState().showSlider).toBe(true);
	});
});
