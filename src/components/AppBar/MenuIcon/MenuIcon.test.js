import { fireEvent, render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { MainStore } from "../../Main";
import Menu from "./MenuIcon.js";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");

describe("MenuIcon Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		MainStore.update((s) => {
			s.showSlider = false;
			s.showSideBar = false;
		});
	});

	it("renders MenuIcon with translations", () => {
		useTranslations.mockReturnValue({ MENU: "Menu Option" });
		useDeviceType.mockReturnValue("desktop");

		const { getByLabelText } = render(<Menu />);
		const button = getByLabelText("Menu Option");
		expect(button).toBeInTheDocument();
	});

	it("toggles showSideBar on desktop click", () => {
		useTranslations.mockReturnValue({ MENU: "Menu" });
		useDeviceType.mockReturnValue("desktop");

		const { getByLabelText } = render(<Menu />);
		const button = getByLabelText("Menu");

		expect(MainStore.getRawState().showSideBar).toBe(false);
		fireEvent.click(button);
		expect(MainStore.getRawState().showSideBar).toBe(true);

		fireEvent.click(button);
		expect(MainStore.getRawState().showSideBar).toBe(false);
	});

	it("toggles showSlider on mobile click", () => {
		useTranslations.mockReturnValue({ MENU: "Menu" });
		useDeviceType.mockReturnValue("phone");

		const { getByLabelText } = render(<Menu />);
		const button = getByLabelText("Menu");

		expect(MainStore.getRawState().showSlider).toBe(false);
		fireEvent.click(button);
		expect(MainStore.getRawState().showSlider).toBe(true);
	});
});
