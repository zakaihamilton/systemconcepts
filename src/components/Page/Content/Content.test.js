import { act, render, screen } from "@testing-library/react";
import { useSize } from "@util/browser/size";
import { useActivePages, useParentParams } from "@util/domain/views";
import { MainStore } from "../../Main";
import Content from "./Content.js";

jest.mock("@util/browser/size", () => ({
	useSize: jest.fn(),
}));
jest.mock("@util/domain/views", () => ({
	useActivePages: jest.fn(),
	useParentParams: jest.fn(),
}));
jest.mock("../../Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@components/ViewTransition", () => ({ children }) => (
	<div data-testid="view-transition">{children}</div>
));
jest.mock("@data/views", () => [
	{
		id: "player",
		Component: ({ show, url, group, name }) => (
			<div
				data-testid="player"
				data-show={String(!!show)}
				data-url={url}
				data-group={group}
				data-name={name}
			/>
		),
	},
	{
		id: "library",
		Component: (props) => <div data-testid="library-page">{props.id}</div>,
	},
]);

describe("Content", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useSize.mockReturnValue({ width: 800, height: 600 });
		useParentParams.mockReturnValue({ group: "g", name: "n" });
		MainStore.useState.mockReturnValue({ hash: "library", showSideBar: true });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("returns null without active page", () => {
		useActivePages.mockReturnValue([]);
		const { container } = render(<Content />);
		expect(container.firstChild).toBeNull();
	});

	it("renders page component via ViewTransition", () => {
		const Page = (props) => <div data-testid="page">{props.id}</div>;
		useActivePages.mockReturnValue([
			{ id: "sessions", Component: Page, url: "sessions" },
		]);
		render(<Content />);
		expect(screen.getByTestId("page")).toHaveTextContent("sessions");
		expect(screen.getByTestId("view-transition")).toBeInTheDocument();
	});

	it("shows player when active page is player and keeps stable page identity", () => {
		useActivePages.mockReturnValue([
			{ id: "player", url: "u1", group: "g", name: "n" },
		]);
		const { rerender } = render(<Content />);
		act(() => {
			jest.runAllTimers();
		});
		expect(screen.getByTestId("player")).toHaveAttribute("data-show", "true");

		useActivePages.mockReturnValue([
			{ id: "player", url: "u1", group: "g", name: "n" },
		]);
		rerender(<Content />);
		act(() => {
			jest.runAllTimers();
		});
		expect(screen.getByTestId("player")).toHaveAttribute("data-url", "u1");
	});

	it("updates player page when key params change", () => {
		useActivePages.mockReturnValue([
			{ id: "player", url: "u1", group: "g", name: "n" },
		]);
		const { rerender } = render(<Content />);
		act(() => {
			jest.runAllTimers();
		});

		useActivePages.mockReturnValue([
			{ id: "player", url: "u2", group: "g2", name: "n2" },
		]);
		useParentParams.mockReturnValue({ group: "g2", name: "n2" });
		rerender(<Content />);
		act(() => {
			jest.runAllTimers();
		});
		expect(screen.getByTestId("player")).toHaveAttribute("data-url", "u2");
	});

	it("hides page component for player-only active page without Component", () => {
		useActivePages.mockReturnValue([{ id: "player", url: "u1" }]);
		render(<Content />);
		act(() => {
			jest.runAllTimers();
		});
		expect(screen.queryByTestId("view-transition")).not.toBeInTheDocument();
	});

	it("uses the page id as the transition key when url is missing", () => {
		const Page = (props) => <div data-testid="page">{props.id}</div>;
		useActivePages.mockReturnValue([{ id: "library", Component: Page }]);
		render(<Content />);
		expect(screen.getByTestId("view-transition")).toBeInTheDocument();
	});
});
