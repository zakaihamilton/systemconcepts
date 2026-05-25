import { render } from "@testing-library/react";
import { useFetchJSON } from "@util/api/fetch";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Users from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/fetch");
jest.mock("@util/browser/styles");
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children }) => (
	<div data-testid="row">{children}</div>
));
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);

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
