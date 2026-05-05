import { render } from "@testing-library/react";
import App from "./App";

jest.mock("./Theme", () => ({ children }) => (
	<div data-testid="theme">{children}</div>
));
jest.mock("./Head", () => () => <div data-testid="head" />);
jest.mock("./Main", () => () => <div data-testid="main" />);
jest.mock("@vercel/speed-insights/next", () => ({
	SpeedInsights: () => <div data-testid="speed-insights" />,
}));
jest.mock("@vercel/analytics/react", () => ({
	Analytics: () => <div data-testid="analytics" />,
}));
jest.mock("@mui/material", () => ({
	NoSsr: ({ children }) => <div data-testid="no-ssr">{children}</div>,
}));

describe("App Component", () => {
	it("renders without crashing", () => {
		const { getByTestId } = render(<App />);
		expect(getByTestId("theme")).toBeInTheDocument();
		expect(getByTestId("head")).toBeInTheDocument();
		expect(getByTestId("main")).toBeInTheDocument();
		expect(getByTestId("no-ssr")).toBeInTheDocument();
	});
});
