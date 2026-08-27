import { render, screen } from "@testing-library/react";
import App, { AppErrorBoundary } from "./index.js";

jest.mock("../Theme", () => ({ children }) => (
	<div data-testid="theme">{children}</div>
));
jest.mock("../Head", () => () => <div data-testid="head" />);
jest.mock("../Main", () => () => <div data-testid="main" />);
jest.mock("@vercel/speed-insights/next", () => ({
	SpeedInsights: ({ sampleRate }) => (
		<div data-testid="speed-insights" data-sample-rate={sampleRate} />
	),
}));
jest.mock("@vercel/analytics/react", () => ({
	Analytics: () => <div data-testid="analytics" />,
}));
jest.mock("@ui", () => ({
	NoSsr: ({ children }) => <div data-testid="no-ssr">{children}</div>,
}));

describe("App Component", () => {
	it("renders without crashing", () => {
		const { getByTestId } = render(<App />);
		expect(getByTestId("speed-insights")).toHaveAttribute(
			"data-sample-rate",
			"0.5",
		);
		expect(getByTestId("theme")).toBeInTheDocument();
		expect(getByTestId("head")).toBeInTheDocument();
		expect(getByTestId("main")).toBeInTheDocument();
		expect(getByTestId("no-ssr")).toBeInTheDocument();
	});

	it("removes the splash when a frozen tab is restored", () => {
		const splash = document.createElement("div");
		splash.id = "app-splash";
		document.body.appendChild(splash);
		render(<App />);
		expect(document.getElementById("app-splash")).toBeNull();
		const restored = document.createElement("div");
		restored.id = "app-splash";
		document.body.appendChild(restored);
		window.dispatchEvent(new Event("pageshow"));
		document.dispatchEvent(new Event("resume"));
		expect(document.getElementById("app-splash")).toBeNull();
	});
});

describe("AppErrorBoundary", () => {
	const consoleError = jest
		.spyOn(console, "error")
		.mockImplementation(() => {});

	afterAll(() => {
		consoleError.mockRestore();
	});

	it("hides the splash and offers a reload when a child crashes", () => {
		const splash = document.createElement("div");
		splash.id = "app-splash";
		document.body.appendChild(splash);

		function Boom() {
			throw new Error("render failed");
		}

		render(
			<AppErrorBoundary>
				<Boom />
			</AppErrorBoundary>,
		);

		expect(document.getElementById("app-splash")).toBeNull();
		expect(screen.getByRole("alert")).toHaveTextContent("failed to load");
		expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
	});
});
