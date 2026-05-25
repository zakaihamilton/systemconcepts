import { SyncActiveStore } from "@sync/syncState";
import { render } from "@testing-library/react";
import { useStoreState } from "@util/store";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import Cookies from "js-cookie";
import useDarkMode from "use-dark-mode";
import Settings from "./index.js";

jest.mock("use-dark-mode");
jest.mock("@util/translations");
jest.mock("@util/store");
jest.mock("@util/styles");
jest.mock("js-cookie");
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/Dynamic", () => () => <div data-testid="dynamic" />);
jest.mock("@widgets/Row", () => ({ children }) => (
	<div data-testid="row">{children}</div>
));

describe("Settings View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDarkMode.mockReturnValue({
			value: false,
			enable: jest.fn(),
			disable: jest.fn(),
		});
		useTranslations.mockReturnValue({ NAME: "Name", SETTING: "Setting" });
		useStoreState.mockReturnValue({
			language: ["auto"],
			fontSize: ["16"],
			speedToolbar: ["top"],
		});
		useDeviceType.mockReturnValue("desktop");
		SyncActiveStore.useState.mockReturnValue({ locked: false, autoSync: true });
		Cookies.get.mockReturnValue("visitor");
	});

	it("renders settings table", () => {
		const { getByTestId } = render(<Settings />);
		expect(getByTestId("table")).toBeInTheDocument();
	});
});
