import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { useListing } from "@util/storage/storage";
import Storage from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/storage/storage", () => ({
	useListing: jest.fn(),
	__esModule: true,
	default: {
		importFolder: jest.fn(),
		exportFolderAsZip: jest.fn(),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn().mockReturnValue({ format: jest.fn() }),
}));
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock("../Actions", () => ({
	__esModule: true,
	default: () => <div data-testid="actions" />,
	useActions: jest.fn((data) => data),
}));
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("../Destination", () => () => <div data-testid="destination" />);

describe("Storage View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			SIZE: "Size",
			DATE: "Date",
		});
		useDeviceType.mockReturnValue("desktop");
		useListing.mockReturnValue([[], false, null]);
	});

	it("renders storage table and sub-components", () => {
		const { getByTestId } = render(<Storage path="local" />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("actions")).toBeInTheDocument();
		expect(getByTestId("destination")).toBeInTheDocument();
	});

	it("shows loading state from useListing", () => {
		useListing.mockReturnValue([[], true, null]);
		const { getByTestId } = render(<Storage path="local" />);
		// Table handles loading, but we verify it's rendered
		expect(getByTestId("table")).toBeInTheDocument();
	});
});
