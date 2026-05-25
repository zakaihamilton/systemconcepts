import { render } from "@testing-library/react";
import { useOnline } from "@util/online";
import { useSessions } from "@util/sessions";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import { useUpdateSessions } from "@util/updateSessions";
import Groups from "./index.js";

jest.mock("@util/translations");
jest.mock("@util/sessions");
jest.mock("@util/groups", () => ({
	GroupsStore: {
		useState: jest.fn().mockReturnValue({ counter: 1, showDisabled: false }),
		update: jest.fn(),
	},
}));
jest.mock("@util/updateSessions");
jest.mock("@util/online");
jest.mock("@util/styles");
jest.mock("@util/storage", () => ({
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
