import { fireEvent, render, screen } from "@testing-library/react";
import { useLanguage } from "@util/domain/language";
import { useTranslations } from "@util/domain/translations";
import { usePages } from "@util/domain/views";
import useDarkMode from "use-dark-mode";
import { MainStore } from "../../Main";
import QuickAccess from "./QuickAccess.js";

jest.mock("use-dark-mode");
jest.mock("@util/domain/language", () => ({
	useLanguage: jest.fn(),
}));
jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock("@util/domain/views", () => ({
	usePages: jest.fn(),
}));
jest.mock("../../Main", () => ({
	MainStore: {
		update: jest.fn((fn) => {
			const state = { language: "eng" };
			fn(state);
			return state;
		}),
	},
}));
jest.mock("@data/languages", () => [
	{ id: "eng", name: "English" },
	{ id: "heb", name: "Hebrew" },
]);
jest.mock("@ui", () => ({
	Divider: (props) => <hr data-testid="divider" {...props} />,
}));
jest.mock("@widgets/List", () => {
	const _React = require("react");
	return ({ items, onClick, state }) => (
		<div data-testid="list">
			{(items || []).map((item) => (
				<div key={item.id} data-testid={`qa-${item.id}`}>
					<button
						type="button"
						data-testid={`action-${item.id}`}
						onClick={() => item.onClick?.()}
					>
						{item.name}
					</button>
					{item.items?.map((child) => (
						<button
							key={child.id}
							type="button"
							data-testid={`lang-${child.id}`}
							onClick={() => child.setSelected?.(child.id)}
						>
							{child.name}
						</button>
					))}
					{item.onToggle && (
						<button
							type="button"
							data-testid={`toggle-${item.id}`}
							onClick={() => item.onToggle(true)}
						>
							toggle
						</button>
					)}
					<button
						type="button"
						data-testid={`click-${item.id}`}
						onClick={onClick}
					>
						close
					</button>
					<span data-testid={`selected-${item.id}`}>{item.selected}</span>
					<span data-testid="state">{String(!!state)}</span>
				</div>
			))}
		</div>
	);
});

describe("QuickAccess", () => {
	const darkMode = { value: false, toggle: jest.fn() };

	beforeEach(() => {
		jest.clearAllMocks();
		useLanguage.mockReturnValue("eng");
		useTranslations.mockReturnValue({
			RELOAD: "Reload",
			LIGHT_MODE: "Light",
			DARK_MODE: "Dark",
			LANGUAGE: "Language",
			TOOLS: "Tools",
		});
		usePages.mockReturnValue([
			{
				id: "sync",
				name: "Sync",
				sidebar: true,
				category: "tools",
				path: "sync",
			},
			{
				id: "qa1",
				name: "Quick",
				sidebar: true,
				category: "quickaccess",
			},
			{ id: "hidden", name: "Hidden", sidebar: false, category: "tools" },
		]);
		useDarkMode.mockReturnValue(darkMode);
	});

	it("renders reload, dark mode, language, tools, and quickaccess items", () => {
		const closeDrawer = jest.fn();
		const onScrollToBottom = jest.fn();
		render(
			<QuickAccess
				closeDrawer={closeDrawer}
				state={[{}, jest.fn()]}
				onScrollToBottom={onScrollToBottom}
			/>,
		);

		expect(screen.getByTestId("qa-reload")).toBeInTheDocument();
		expect(screen.getByTestId("qa-toggleDarkMode")).toBeInTheDocument();
		expect(screen.getByTestId("qa-language")).toBeInTheDocument();
		expect(screen.getByTestId("qa-tools")).toBeInTheDocument();
		expect(screen.getByTestId("qa-qa1")).toBeInTheDocument();
		expect(screen.getByText("Dark")).toBeInTheDocument();
	});

	it("toggles dark mode", () => {
		render(<QuickAccess closeDrawer={jest.fn()} />);
		fireEvent.click(screen.getByTestId("action-toggleDarkMode"));
		expect(darkMode.toggle).toHaveBeenCalled();
	});

	it("sets language and scrolls on toggle", () => {
		const onScrollToBottom = jest.fn();
		render(
			<QuickAccess
				closeDrawer={jest.fn()}
				onScrollToBottom={onScrollToBottom}
			/>,
		);
		fireEvent.click(screen.getByTestId("lang-heb"));
		expect(MainStore.update).toHaveBeenCalled();
		fireEvent.click(screen.getByTestId("toggle-language"));
		expect(onScrollToBottom).toHaveBeenCalled();
		fireEvent.click(screen.getByTestId("toggle-tools"));
		expect(onScrollToBottom).toHaveBeenCalledTimes(2);
	});

	it("shows light mode label when dark mode is on", () => {
		useDarkMode.mockReturnValue({ value: true, toggle: jest.fn() });
		render(<QuickAccess closeDrawer={jest.fn()} />);
		expect(screen.getByText("Light")).toBeInTheDocument();
	});

	it("includes a reload action", () => {
		render(<QuickAccess closeDrawer={jest.fn()} />);
		expect(screen.getByTestId("action-reload")).toHaveTextContent("Reload");
	});

	it("closes the drawer when a quick access item is clicked", () => {
		const closeDrawer = jest.fn();
		render(<QuickAccess closeDrawer={closeDrawer} state={[{}, jest.fn()]} />);
		fireEvent.click(screen.getByTestId("click-reload"));
		expect(closeDrawer).toHaveBeenCalled();
	});

	it("does not scroll when onScrollToBottom is omitted", () => {
		render(<QuickAccess closeDrawer={jest.fn()} />);
		expect(() => {
			fireEvent.click(screen.getByTestId("toggle-language"));
		}).not.toThrow();
	});
});
