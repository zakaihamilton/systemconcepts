import { act, render } from "@testing-library/react";
import { useOnline } from "@util/browser/online";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
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
jest.mock("@widgets/Table", () => (props) => (
	<div
		data-testid="table"
		data-columns={props.columns.map((column) => column?.id)}
	/>
));
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

	it("does not show a group-list progress indicator after its update completes", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group]]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 2, count: 2 }],
			busy: false,
			start: null,
		});

		const { getByTestId } = render(<Groups />);
		await act(async () => {});
		expect(getByTestId("table").dataset.columns).not.toContain("progress");
	});

	it("shows a group-list progress indicator while a group update is unfinished", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group]]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 1, count: 2 }],
			busy: true,
			start: Date.now(),
		});

		const { getByTestId } = render(<Groups />);
		await act(async () => {});
		expect(getByTestId("table").dataset.columns).toContain("progress");
	});
});
