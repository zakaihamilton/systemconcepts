import { render } from "@testing-library/react";
import { useFetchJSON } from "@util/fetch";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import Users from "./Users";

jest.mock("@util/translations");
jest.mock("@util/fetch");
jest.mock("@util/styles");
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children }) => (
	<div data-testid="row">{children}</div>
));
jest.mock("./ItemMenu", () => () => <div data-testid="item-menu" />);

describe("Users View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			ID: "ID",
			EMAIL_ADDRESS: "Email",
			DATE: "Date",
			ROLE: "Role",
		});
		useDeviceType.mockReturnValue("desktop");
		useFetchJSON.mockReturnValue([[], false, null]);
	});

	it("renders users table and status bar", () => {
		const { getByTestId } = render(<Users />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("status-bar")).toBeInTheDocument();
	});
});
