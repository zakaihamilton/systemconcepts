import { MainStore } from "@components/Main";
import { render } from "@testing-library/react";
import { useDirection } from "@util/data/direction";
import useDarkMode from "use-dark-mode";
import Theme from "./index.js";

jest.mock("@util/data/direction");
jest.mock("use-dark-mode");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));

describe("Theme Component", () => {
	beforeEach(() => {
		useDirection.mockReturnValue("ltr");
		useDarkMode.mockReturnValue({ value: false });
		MainStore.useState.mockImplementation((selector) =>
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
		useDarkMode.mockReturnValue({ value: true });
		render(
			<Theme>
				<div>Test</div>
			</Theme>,
		);
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	});

	it("sets font-size on body", () => {
		MainStore.useState.mockImplementation((selector) =>
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
