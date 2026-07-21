import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchJSON, useFetchJSON } from "@util/api/fetch";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { addPath } from "@util/domain/views";
import Users, { UsersStore } from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/fetch");
jest.mock("@util/browser/styles");
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((p) => p),
}));

let lastTableProps = null;
jest.mock("@widgets/Table", () => (props) => {
	lastTableProps = props;
	return (
		<div data-testid="table" data-loading={String(!!props.loading)}>
			{props.statusBar}
			<button
				type="button"
				data-testid="import"
				onClick={() => props.onImport?.([{ id: "u1" }])}
			>
				import
			</button>
			<button type="button" data-testid="refresh" onClick={props.refresh}>
				refresh
			</button>
		</div>
	);
});
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children }) => <div>{children}</div>);
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);

describe("Users View", () => {
	const users = [
		{
			id: "u1",
			firstName: "Ada",
			lastName: "Lovelace",
			role: "admin",
			utc: Date.now(),
			email: "ada@example.com",
		},
		{
			id: "u2",
			firstName: "Bob",
			lastName: "Smith",
			role: "visitor",
			utc: Date.now(),
			email: "bob@example.com",
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		lastTableProps = null;
		useTranslations.mockReturnValue({
			NAME: "Name",
			ID: "ID",
			EMAIL_ADDRESS: "Email",
			DATE: "Date",
			ROLE: "Role",
			ADMIN: "Admin",
			VISITOR: "Visitor",
			USER: "User",
		});
		useDeviceType.mockReturnValue("desktop");
		useFetchJSON.mockReturnValue([users, false, null]);
		UsersStore.update((s) => {
			s.select = null;
			s.roleFilter = "";
			s.mode = "";
			s.counter = 1;
		});
	});

	it("renders users table and status bar", () => {
		render(<Users />);
		expect(screen.getByTestId("table")).toBeInTheDocument();
		expect(screen.getByTestId("status-bar")).toBeInTheDocument();
	});

	it("maps users and navigates on click when not selecting", () => {
		render(<Users />);
		const mapped = lastTableProps.mapper(users[0]);
		expect(mapped.name).toBe("Ada Lovelace");
		mapped.nameWidget.props.onClick();
		expect(addPath).toHaveBeenCalledWith(expect.stringContaining("user/u1"));
	});

	it("toggles selection when select mode is active", () => {
		const { rerender } = render(<Users />);
		UsersStore.update((s) => {
			s.select = [];
		});
		rerender(<Users />);
		const mapped = lastTableProps.mapper(users[0]);
		mapped.nameWidget.props.onClick();
		expect(UsersStore.getRawState().select).toHaveLength(1);

		UsersStore.update((s) => {
			s.select = [{ id: "u1" }];
		});
		rerender(<Users />);
		lastTableProps.mapper(users[0]).nameWidget.props.onClick();
		expect(UsersStore.getRawState().select).toHaveLength(0);
	});

	it("filters by role via role column click", () => {
		render(<Users />);
		const roleCol = lastTableProps.columns.find(
			(c) => c && c.id === "roleWidget",
		);
		roleCol.onClick({ role: "admin" });
		expect(UsersStore.getRawState().roleFilter).toBe("admin");
		roleCol.onClick({ role: "admin" });
		expect(UsersStore.getRawState().roleFilter).toBe("");
	});

	it("filters data by roleFilter", () => {
		const { rerender } = render(<Users />);
		UsersStore.update((s) => {
			s.roleFilter = "admin";
		});
		rerender(<Users />);
		expect(lastTableProps.filter(users[0])).toBe(true);
		expect(lastTableProps.filter(users[1])).toBe(false);
	});

	it("hides phone-only columns on phone", () => {
		useDeviceType.mockReturnValue("phone");
		render(<Users />);
		const ids = lastTableProps.columns.filter(Boolean).map((c) => c.id);
		expect(ids).not.toContain("id");
		expect(ids).not.toContain("email");
	});

	it("imports users via onImport", async () => {
		fetchJSON.mockResolvedValue({});
		render(<Users />);
		fireEvent.click(screen.getByTestId("import"));
		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalledWith(
				"/api/users",
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	it("handles import errors", async () => {
		fetchJSON.mockResolvedValue({ err: "fail" });
		render(<Users />);
		fireEvent.click(screen.getByTestId("import"));
		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalled();
		});
	});

	it("refreshes by bumping counter", () => {
		const before = UsersStore.getRawState().counter;
		render(<Users />);
		fireEvent.click(screen.getByTestId("refresh"));
		expect(UsersStore.getRawState().counter).toBeGreaterThan(before);
	});

	it("maps RTL names", () => {
		render(<Users />);
		const mapped = lastTableProps.mapper({
			id: "u3",
			firstName: "עדה",
			lastName: "לוולייס",
			role: "user",
			utc: Date.now(),
		});
		expect(mapped.name).toContain("עדה");
	});
});
