import { fireEvent, render, screen } from "@testing-library/react";
import GroupItemMenu from "./ItemMenu";

jest.mock("@components/ItemMenu", () => ({ menuItems }) => (
	<button
		type="button"
		onClick={() =>
			menuItems.find((menuItem) => menuItem.id === "enable_disable").onClick()
		}
	>
		Toggle group
	</button>
));

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

describe("Group item menu", () => {
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

		fireEvent.click(screen.getByRole("button", { name: "Toggle group" }));

		expect(setGroups).toHaveBeenCalledTimes(1);
		expect(nextGroups).toEqual([{ name: "American", disabled: true }]);
		expect(nextGroups[0]).not.toBe(group);
	});
});
