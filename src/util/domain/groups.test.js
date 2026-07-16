import { readGroups } from "@sync/groups";
import { act, render, screen, waitFor } from "@testing-library/react";
import { GroupsStore, useGroups } from "./groups";

jest.mock("@sync/groups", () => ({
	readGroups: jest.fn(),
	writeGroups: jest.fn(),
}));

jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		subscribe: jest.fn(() => () => {}),
	},
}));

function GroupLoadingStatus({ id }) {
	const [, loading] = useGroups();
	return <output data-testid={id}>{String(loading)}</output>;
}

describe("useGroups", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		GroupsStore.update((state) => {
			state.groups = [];
			state.settings = {};
			state.busy = false;
			state.loaded = false;
		});
	});

	it("clears loading for every consumer when they mount during the same read", async () => {
		let resolveGroups;
		readGroups.mockReturnValue(
			new Promise((resolve) => {
				resolveGroups = resolve;
			}),
		);

		render(
			<>
				<GroupLoadingStatus id="first" />
				<GroupLoadingStatus id="second" />
			</>,
		);

		expect(screen.getByTestId("first")).toHaveTextContent("true");
		expect(screen.getByTestId("second")).toHaveTextContent("true");

		await act(async () => {
			resolveGroups({
				groups: [{ name: "example" }],
				settings: {},
				version: 1,
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId("first")).toHaveTextContent("false");
			expect(screen.getByTestId("second")).toHaveTextContent("false");
		});
	});
});
