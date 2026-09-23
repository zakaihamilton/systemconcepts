import { MainStore } from "@components/Main/MainStore";
import { render } from "@testing-library/react";
import { useDirection } from "@util/data/direction";
import useDarkMode from "use-dark-mode";
import Theme from "./index";

jest.mock("@util/data/direction");
jest.mock("use-dark-mode");
jest.mock("@components/Main/MainStore", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));

describe("Theme Component", () => {
	beforeEach(() => {
		asMock(useDirection).mockReturnValue("ltr");
		asMock(useDarkMode).mockReturnValue({ value: false });
		asMock(MainStore.useState).mockImplementation((selector: any) =>
			selector({ fontSize: "16" }),
		);
	});

	it("renders children within ThemeProvider", () => {
		const { getByText } = render(
			<Theme>
				<div>Test Child</div>
			</Theme>,
		);
		expect(getByText("Test Child")).toBeInTheDocument();
	});

	it("sets data-theme attribute on document element", () => {
		asMock(useDarkMode).mockReturnValue({ value: true });
		render(
			<Theme>
				<div>Test</div>
			</Theme>,
		);
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	});

	it("sets font-size on body", () => {
		asMock(MainStore.useState).mockImplementation((selector: any) =>
			selector({ fontSize: "20" }),
		);
		render(
			<Theme>
				<div>Test</div>
			</Theme>,
		);
		expect(document.body.style.fontSize).toBe("20px");
	});
});
