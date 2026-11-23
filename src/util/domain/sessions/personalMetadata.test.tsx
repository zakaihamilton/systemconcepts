import "../sessionsTestSetup";
import { waitFor } from "@testing-library/react";
import { useGroups } from "@util/domain/groups";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import storage from "@util/storage/storage";
import { SessionsStore, useSessions } from "../sessions";
import {
	createSessionsTestHarness,
	mockSessionsStorageFiles,
	sessionFixture,
} from "../sessionsTestSetup";

function file(path: string, name?: string) {
	return { path, name: name || path.split("/").pop(), type: "file" };
}

const { getSessionsState, renderHarness, resetSessionsTestState } =
	createSessionsTestHarness(
		useSessions,
		SessionsStore,
		useGroups,
		compactLegacySessionThumbnails,
		storage,
	);

describe("useSessions personal metadata", () => {
	beforeEach(resetSessionsTestState);

	it("merges personal metadata (position/duration) for split group sessions", async () => {
		mockSessionsStorageFiles(
			storage,
			[
				"/local/sync/groups.json",
				"/local/sync/files.json",
				"/local/sync/american/2024.json",
				"local/personal",
			],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "american" }],
				}),
				"/local/sync/files.json": JSON.stringify([
					{ path: "/american/2024.json" },
				]),
				"/local/sync/american/2024.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-05-05 Test Session",
							"Test Session",
							"2024-05-05",
							"american",
							"2024",
							"audio",
						),
					],
				}),
				"local/personal/american/2024.json": JSON.stringify({
					"2024-05-05 Test Session": { position: 42, duration: 99 },
				}),
			},
		);
		asMock(storage.getRecursiveList).mockResolvedValue([
			file("local/personal/american/2024.json", "2024.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		expect(getSessionsState()[0][0].position).toBe(42);
	});

	it("recovers gracefully when a personal metadata file fails to parse", async () => {
		mockSessionsStorageFiles(
			storage,
			["/local/sync/groups.json", "local/personal"],
			{
				"/local/sync/groups.json": JSON.stringify({ groups: [] }),
				"local/personal/broken.json": "not json",
			},
		);
		asMock(storage.getRecursiveList).mockResolvedValue([
			file("local/personal/broken.json", "broken.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
	});

	it("loads personal metadata from merged group files and bundle.json", async () => {
		asMock(useGroups).mockReturnValue([
			[
				{ name: "american", color: "#fff", merged: true },
				{ name: "bundledgroup", bundled: true },
			],
			false,
			jest.fn(),
		]);
		mockSessionsStorageFiles(
			storage,
			[
				"/local/sync/groups.json",
				"/local/sync/american.json",
				"/local/sync/bundle.json",
				"local/personal",
			],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [
						{ name: "american" },
						{ name: "bundledgroup", bundled: true },
					],
				}),
				"/local/sync/american.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-01-01 Merged Session",
							"Merged Session",
							"2024-01-01",
							"american",
							"2024",
							"video",
						),
					],
				}),
				"/local/sync/bundle.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-02-02 Bundled Session",
							"Bundled Session",
							"2024-02-02",
							"bundledgroup",
							"2024",
							"audio",
						),
					],
				}),
				"local/personal/american.json": JSON.stringify({
					"2024/2024-01-01 Merged Session.json": {
						position: 11,
						duration: 22,
					},
				}),
				"local/personal/bundle.json": JSON.stringify({
					"bundledgroup/2024/2024-02-02 Bundled Session.json": {
						position: 33,
						duration: 44,
					},
				}),
			},
		);
		asMock(storage.getRecursiveList).mockResolvedValue([
			file("local/personal/american.json", "american.json"),
			file("local/personal/bundle.json", "bundle.json"),
			file("local/personal/unknown/deep/nested.json", "nested.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(2);
		});
		const [items] = getSessionsState();
		const merged = items.find((item: any) => item.group === "american");
		const bundled = items.find((item: any) => item.group === "bundledgroup");
		expect(merged.position).toBe(11);
		expect(bundled.position).toBe(33);
	});

	it("logs when personal metadata listing fails", async () => {
		mockSessionsStorageFiles(
			storage,
			["/local/sync/groups.json", "local/personal"],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "american" }],
				}),
			},
		);
		asMock(storage.getRecursiveList).mockRejectedValue(
			new Error("personal list fail"),
		);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error loading personal metadata"),
			expect.any(Error),
		);
	});

	it("skips personal metadata files with unknown directory structures", async () => {
		mockSessionsStorageFiles(
			storage,
			[
				"/local/sync/groups.json",
				"/local/sync/files.json",
				"/local/sync/american/2024.json",
				"local/personal",
			],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "american" }],
				}),
				"/local/sync/files.json": JSON.stringify([
					{ path: "/american/2024.json" },
				]),
				"/local/sync/american/2024.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-01-01 Session",
							"Session",
							"2024-01-01",
							"american",
							"2024",
							"audio",
						),
					],
				}),
				"local/personal/weird/extra/deep.json": JSON.stringify({
					"2024/session": { position: 5 },
				}),
			},
		);
		asMock(storage.getRecursiveList).mockResolvedValue([
			{
				type: "file",
				name: "deep.json",
				path: "local/personal/weird/extra/deep.json",
			},
		]);

		renderHarness();
		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
			expect(items[0].name).toBe("Session");
		});
	});
});
