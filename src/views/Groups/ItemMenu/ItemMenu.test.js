import { fireEvent, render, screen } from "@testing-library/react";
import GroupItemMenu from "./ItemMenu.js";

let _lastMenuItems = [];

jest.mock("@components/ItemMenu", () => ({ menuItems }) => {
	_lastMenuItems = menuItems;
	return (
		<div data-testid="item-menu">
			{(menuItems || []).map((item) => (
				<button
					key={item.id}
					type="button"
					data-testid={`menu-${item.id}`}
					onClick={() => item.onClick?.()}
				>
					{item.name}
				</button>
			))}
		</div>
	);
});

jest.mock("@util/domain/translations", () => ({
	useTranslations: () => ({
		STATISTICS: "Statistics",
		SYNC: "Sync",
		SYNC_ALL_SESSIONS: "Sync all sessions",
		UPDATE_METADATA_CURRENT_YEAR: "Update metadata (current year)",
		UPDATE_METADATA: "Update metadata",
		ENABLE: "Enable",
		DISABLE: "Disable",
		SPLIT: "Split",
		MERGE: "Merge",
		SEPARATE: "Separate",
		BUNDLE: "Bundle",
	}),
}));

jest.mock(
	"../Statistics",
	() =>
		({ open, onClose, group }) =>
			open ? (
				<div data-testid="statistics">
					<span>{group.name}</span>
					<button type="button" onClick={onClose}>
						close-stats
					</button>
				</div>
			) : null,
);

describe("Group item menu", () => {
	beforeEach(() => {
		_lastMenuItems = [];
	});

	it("toggles a frozen group without mutating its source object", () => {
		const group = Object.freeze({ name: "American", disabled: false });
		let nextGroups;
		const setGroups = jest.fn((updater) => {
			nextGroups = updater([group]);
		});

		render(
			<GroupItemMenu
				item={group}
				store={{}}
				setGroups={setGroups}
				sessions={[]}
			/>,
		);

		fireEvent.click(screen.getByTestId("menu-enable_disable"));
		expect(setGroups).toHaveBeenCalledTimes(1);
		expect(nextGroups).toEqual([{ name: "American", disabled: true }]);
		expect(nextGroups[0]).not.toBe(group);
	});

	it("invokes updateGroup for sync and metadata actions", () => {
		const updateGroup = jest.fn();
		const item = { name: "Will", disabled: true, bundled: true, merged: true };
		render(
			<GroupItemMenu
				item={item}
				updateGroup={updateGroup}
				store={{}}
				setGroups={jest.fn()}
				sessions={[]}
			/>,
		);

		fireEvent.click(screen.getByTestId("menu-sync"));
		expect(updateGroup).toHaveBeenCalledWith("Will");
		fireEvent.click(screen.getByTestId("menu-sync_all"));
		expect(updateGroup).toHaveBeenCalledWith("Will", true);
		fireEvent.click(screen.getByTestId("menu-update_metadata_current_year"));
		expect(updateGroup).toHaveBeenCalledWith("Will", false, true);
		fireEvent.click(screen.getByTestId("menu-update_metadata"));
		expect(updateGroup).toHaveBeenCalledWith("Will", true, true);
		expect(screen.getByText("Enable")).toBeInTheDocument();
		expect(screen.getByText("Split")).toBeInTheDocument();
		expect(screen.getByText("Separate")).toBeInTheDocument();
	});

	it("toggles merged and bundled flags", () => {
		const item = { name: "A", disabled: false, merged: false, bundled: false };
		let groups = [item];
		const setGroups = jest.fn((updater) => {
			groups = updater(groups);
		});
		render(
			<GroupItemMenu
				item={item}
				setGroups={setGroups}
				store={{}}
				sessions={[]}
			/>,
		);
		fireEvent.click(screen.getByTestId("menu-toggle_merged"));
		expect(groups[0].merged).toBe(true);
		fireEvent.click(screen.getByTestId("menu-toggle_bundled"));
		expect(groups[0].bundled).toBe(true);
	});

	it("falls back to disabled for merged label and skips missing group", () => {
		const item = { name: "Missing", disabled: true };
		const setGroups = jest.fn((updater) => updater([{ name: "Other" }]));
		render(
			<GroupItemMenu
				item={item}
				setGroups={setGroups}
				store={{}}
				sessions={[]}
			/>,
		);
		expect(screen.getByText("Split")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("menu-enable_disable"));
		expect(setGroups).toHaveBeenCalled();
	});

	it("opens and closes statistics dialog", () => {
		render(
			<GroupItemMenu
				item={{ name: "G", disabled: false }}
				setGroups={jest.fn()}
				store={{}}
				sessions={[{ name: "s" }]}
			/>,
		);
		fireEvent.click(screen.getByTestId("menu-statistics"));
		expect(screen.getByTestId("statistics")).toBeInTheDocument();
		fireEvent.click(screen.getByText("close-stats"));
		expect(screen.queryByTestId("statistics")).not.toBeInTheDocument();
	});

	it("handles missing updateGroup safely", () => {
		render(
			<GroupItemMenu
				item={{ name: "G", disabled: false }}
				setGroups={jest.fn()}
				store={{}}
				sessions={[]}
			/>,
		);
		fireEvent.click(screen.getByTestId("menu-sync"));
		fireEvent.click(screen.getByTestId("menu-sync_all"));
	});
});
