import { render } from "@testing-library/react";
import { useOnline } from "@util/browser/online";
import { useSessions } from "@util/domain/sessions";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { useUpdateSessions } from "@util/domain/updateSessions";
import Groups from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions");
jest.mock("@util/domain/groups", () => ({
	GroupsStore: {
		useState: jest.fn().mockReturnValue({ counter: 1, showDisabled: false }),
		update: jest.fn(),
	},
}));
jest.mock("@util/domain/updateSessions");
jest.mock("@util/browser/online");
jest.mock("@util/browser/styles");
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	readFile: jest.fn(),
}));
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/Label", () => ({ name }) => (
	<div data-testid="label">{name}</div>
));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);
jest.mock("../ColorPicker", () => () => <div data-testid="color-picker" />);
jest.mock("../ProgressDialog", () => () => (
	<div data-testid="progress-dialog" />
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("js-cookie", () => ({
	get: jest.fn().mockReturnValue("test"),
}));

describe("Groups View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			PROGRESS: "Progress",
			STORAGE: "Storage",
			SIZE: "Size",
			SESSIONS: "Sessions",
			COLOR: "Color",
		});
		useSessions.mockReturnValue([[], false, []]);
		useUpdateSessions.mockReturnValue({ status: [], busy: false, start: null });
		useOnline.mockReturnValue(true);
		useDeviceType.mockReturnValue("desktop");
	});

	it("renders groups table and progress dialog", () => {
		const { getByTestId } = render(<Groups />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("progress-dialog")).toBeInTheDocument();
	});
});
