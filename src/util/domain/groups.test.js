import { readGroups, writeGroups } from "@sync/groups";
import { SyncActiveStore } from "@sync/syncState";
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

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

function GroupLoadingStatus({ id }) {
	const [, loading] = useGroups();
	return <output data-testid={id}>{String(loading)}</output>;
}

function GroupsHarness({ onReady }) {
	const [groups, loading, updateGroups] = useGroups();
	onReady?.({ groups, loading, updateGroups });
	return (
		<div>
			<span data-testid="loading">{String(loading)}</span>
			<span data-testid="count">{groups.length}</span>
		</div>
	);
}

describe("useGroups", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		GroupsStore.update((state) => {
			state.groups = [];
			state.settings = {};
			state.busy = false;
			state.loaded = false;
			state.counter = 0;
		});
		readGroups.mockResolvedValue({
			groups: [{ name: "example" }],
			settings: {},
			version: 1,
		});
		writeGroups.mockResolvedValue(undefined);
		SyncActiveStore.subscribe.mockReturnValue(() => {});
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

	it("skips reloads while busy when groups are already present", async () => {
		GroupsStore.update((s) => {
			s.groups = [{ name: "cached" }];
			s.busy = true;
			s.loaded = true;
		});

		render(<GroupsHarness />);
		await waitFor(() => {
			expect(screen.getByTestId("count")).toHaveTextContent("1");
		});
		expect(readGroups).not.toHaveBeenCalled();
	});

	it("skips starting a second load while busy with empty groups", async () => {
		let resolveGroups;
		readGroups.mockReturnValue(
			new Promise((resolve) => {
				resolveGroups = resolve;
			}),
		);

		const { rerender } = render(<GroupsHarness />);
		await waitFor(() => expect(readGroups).toHaveBeenCalledTimes(1));
		rerender(<GroupsHarness />);
		expect(readGroups).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveGroups({ groups: [], settings: {}, version: 1 });
		});
	});

	it("marks loaded even when readGroups fails", async () => {
		readGroups.mockRejectedValue(new Error("boom"));
		render(<GroupsHarness />);
		await waitFor(() => {
			expect(screen.getByTestId("loading")).toHaveTextContent("false");
		});
		expect(GroupsStore.getRawState().loaded).toBe(true);
		expect(GroupsStore.getRawState().busy).toBe(false);
	});

	it("updateGroups accepts an array and writes groups", async () => {
		let api;
		render(
			<GroupsHarness
				onReady={(value) => {
					api = value;
				}}
			/>,
		);
		await waitFor(() => expect(api).toBeTruthy());

		await act(async () => {
			await api.updateGroups([{ name: "new-group" }]);
		});

		expect(writeGroups).toHaveBeenCalledWith({
			groups: [{ name: "new-group" }],
			settings: {},
		});
		expect(GroupsStore.getRawState().groups[0].name).toBe("new-group");
	});

	it("updateGroups accepts a function updater and bumps counters on changes", async () => {
		GroupsStore.update((s) => {
			s.groups = [{ name: "alpha", counter: 2 }];
			s.settings = { theme: "dark" };
			s.loaded = true;
			s.busy = false;
		});
		readGroups.mockResolvedValue({
			groups: [{ name: "alpha", counter: 2 }],
			settings: { theme: "dark" },
			version: 1,
		});

		let api;
		render(
			<GroupsHarness
				onReady={(value) => {
					api = value;
				}}
			/>,
		);
		await waitFor(() => expect(api).toBeTruthy());

		await act(async () => {
			await api.updateGroups((groups) => [
				{ name: "alpha", label: "changed" },
				...groups.filter((g) => g.name !== "alpha"),
			]);
		});

		expect(writeGroups).toHaveBeenCalled();
		const written = writeGroups.mock.calls.at(-1)[0].groups;
		expect(written.find((g) => g.name === "alpha").counter).toBe(3);
	});

	it("updateGroups keeps unchanged groups without bumping counter", async () => {
		GroupsStore.update((s) => {
			s.groups = [{ name: "alpha", counter: 1 }];
			s.settings = {};
			s.loaded = true;
			s.busy = false;
		});

		let api;
		render(
			<GroupsHarness
				onReady={(value) => {
					api = value;
				}}
			/>,
		);
		await waitFor(() => expect(api).toBeTruthy());

		await act(async () => {
			await api.updateGroups([{ name: "alpha", counter: 1 }]);
		});

		const written = writeGroups.mock.calls.at(-1)[0].groups;
		expect(written[0].counter).toBe(1);
	});

	it("updateGroups clears busy when writeGroups fails", async () => {
		writeGroups.mockRejectedValue(new Error("write failed"));
		let api;
		render(
			<GroupsHarness
				onReady={(value) => {
					api = value;
				}}
			/>,
		);
		await waitFor(() => expect(api).toBeTruthy());

		await act(async () => {
			await api.updateGroups([{ name: "x" }]);
		});

		expect(GroupsStore.getRawState().busy).toBe(false);
	});

	it("reloads when the sync counter subscription fires", async () => {
		let counterCb;
		SyncActiveStore.subscribe.mockImplementation((_selector, cb) => {
			counterCb = cb;
			return () => {};
		});

		render(<GroupsHarness />);
		await waitFor(() => expect(readGroups).toHaveBeenCalledTimes(1));

		await act(async () => {
			counterCb(2);
		});
		await waitFor(() => expect(readGroups).toHaveBeenCalledTimes(2));
	});
});
