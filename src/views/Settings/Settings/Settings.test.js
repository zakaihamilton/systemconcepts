import { SyncActiveStore } from "@sync/syncState";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useStoreState } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { addPath, toPath } from "@util/domain/views";
import Cookies from "js-cookie";
import useDarkMode from "use-dark-mode";
import Settings from "./Settings.js";

jest.mock("use-dark-mode");
jest.mock("@util/domain/translations");
jest.mock("@util/browser/store");
jest.mock("@util/browser/styles");
jest.mock("js-cookie");
jest.mock("@util/domain/language", () => ({
	getPreferredLanguage: () => ({ name: "English", id: "eng" }),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((...parts) => parts.join("/")),
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@widgets/Table", () => ({ data, mapper }) => (
	<div data-testid="table">
		{(data || []).map((item) => {
			const mapped = mapper(item);
			return (
				<div key={item.id} data-testid={`row-${item.id}`}>
					{mapped.title}
					{mapped.widget}
				</div>
			);
		})}
	</div>
));
jest.mock("@widgets/Dynamic", () => ({ items, state }) => (
	<div data-testid="dynamic">
		{(items || []).map((item) => (
			<button
				key={item.id}
				type="button"
				data-testid={`dyn-${item.id}`}
				onClick={() => state[1]?.(item.id)}
			>
				{item.name}
			</button>
		))}
	</div>
));
jest.mock("@widgets/Row", () => ({ children, onClick, href }) => (
	<button type="button" data-href={href} onClick={onClick}>
		{children}
	</button>
));
jest.mock("@ui/Button", () => ({ children, onClick }) => (
	<button type="button" onClick={onClick}>
		{children}
	</button>
));
jest.mock("@data/fontSizes", () => [
	{ id: "16", name: "MEDIUM", devices: ["desktop", "phone"] },
]);
jest.mock("@data/languages", () => [{ id: "heb", name: "Hebrew" }]);

describe("Settings View", () => {
	const darkMode = { value: false, enable: jest.fn(), disable: jest.fn() };
	const languageState = ["auto", jest.fn()];
	const fontSizeState = ["16", jest.fn()];
	const speedToolbarState = ["top", jest.fn()];

	beforeEach(() => {
		jest.clearAllMocks();
		useDarkMode.mockReturnValue(darkMode);
		useTranslations.mockReturnValue({
			NAME: "Name",
			SETTING: "Setting",
			LANGUAGE: "Language",
			LANGUAGE_DESCRIPTION: "Lang desc",
			AUTO: "Auto",
			DARK_MODE: "Dark Mode",
			DARK_MODE_DESCRIPTION: "Dark desc",
			ON: "On",
			OFF: "Off",
			UPLOAD: "Upload",
			UPLOAD_DESCRIPTION: "Upload desc",
			AUTO_SYNC: "Auto Sync",
			AUTO_SYNC_DESCRIPTION: "Auto desc",
			SPEED_TOOLBAR: "Speed",
			SPEED_TOOLBAR_DESCRIPTION: "Speed desc",
			TOP: "Top",
			BOTTOM: "Bottom",
			FONT_SIZE: "Font",
			FONT_SIZE_DESCRIPTION: "Font desc",
			MEDIUM: "Medium",
			FULL_SYNC: "Full Sync",
			FULL_SYNC_DESCRIPTION: "Full desc",
			CLEAR_STORAGE: "Clear",
			CLEAR_STORAGE_DESCRIPTION: "Clear desc",
			RESET_SETTINGS: "Reset Settings",
			RESET_SETTINGS_DESCRIPTION: "Reset desc",
			RESET: "Reset",
			VERSION: "Version",
			VERSION_DESCRIPTION: "Ver desc",
		});
		useStoreState.mockReturnValue({
			language: languageState,
			fontSize: fontSizeState,
			speedToolbar: speedToolbarState,
		});
		useDeviceType.mockReturnValue("desktop");
		SyncActiveStore.useState.mockReturnValue({ locked: false, autoSync: true });
		Cookies.get.mockReturnValue("visitor");
	});

	it("renders settings table", () => {
		render(<Settings />);
		expect(screen.getByTestId("table")).toBeInTheDocument();
	});

	it("toggles dark mode on and off", () => {
		render(<Settings />);
		const darkRow = screen.getByTestId("row-darkMode");
		fireEvent.click(darkRow.querySelector('[data-testid="dyn-on"]'));
		expect(darkMode.enable).toHaveBeenCalled();
		fireEvent.click(darkRow.querySelector('[data-testid="dyn-off"]'));
		expect(darkMode.disable).toHaveBeenCalled();
	});

	it("shows upload row for admin and toggles locked", () => {
		Cookies.get.mockReturnValue("admin");
		render(<Settings />);
		expect(screen.getByTestId("row-upload")).toBeInTheDocument();
		const uploadRow = screen.getByTestId("row-upload");
		fireEvent.click(uploadRow.querySelector('[data-testid="dyn-off"]'));
		expect(SyncActiveStore.update).toHaveBeenCalled();
		const state = { locked: false };
		SyncActiveStore.update.mock.calls.at(-1)[0](state);
		expect(state.locked).toBe(true);
	});

	it("toggles auto sync", () => {
		render(<Settings />);
		const autoRow = screen.getByTestId("row-autoSync");
		fireEvent.click(autoRow.querySelector('[data-testid="dyn-off"]'));
		const state = { autoSync: true };
		SyncActiveStore.update.mock.calls.at(-1)[0](state);
		expect(state.autoSync).toBe(false);
	});

	it("navigates via target rows and action buttons", () => {
		render(<Settings />);
		fireEvent.click(screen.getByTestId("row-language").querySelector("button"));
		expect(addPath).toHaveBeenCalledWith("languages");
		expect(toPath).toHaveBeenCalled();

		const fullSyncRow = screen.getByTestId("row-fullSync");
		fireEvent.click(
			within(fullSyncRow).getByRole("button", { name: "Full Sync" }),
		);
		expect(addPath).toHaveBeenCalledWith("fullSync");
		fireEvent.click(
			within(screen.getByTestId("row-clearStorage")).getByRole("button", {
				name: "Clear",
			}),
		);
		expect(addPath).toHaveBeenCalledWith("clearStorage");
		fireEvent.click(
			within(screen.getByTestId("row-reset")).getByRole("button", {
				name: "Reset",
			}),
		);
		expect(addPath).toHaveBeenCalledWith("reset");
	});

	it("reflects dark mode on state", () => {
		useDarkMode.mockReturnValue({
			value: true,
			enable: jest.fn(),
			disable: jest.fn(),
		});
		SyncActiveStore.useState.mockReturnValue({ locked: true, autoSync: false });
		render(<Settings />);
		expect(screen.getByTestId("row-darkMode")).toBeInTheDocument();
	});
});
