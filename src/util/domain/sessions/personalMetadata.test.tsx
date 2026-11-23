import { waitFor } from "@testing-library/react";
import { useGroups } from "@util/domain/groups";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import storage from "@util/storage/storage";
import { SessionsStore, useSessions } from "../sessions";
import { createSessionsTestHarness } from "../sessionsTestSetup";

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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json" ||
				path === "local/personal"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-05-05 Test Session",
							name: "Test Session",
							date: "2024-05-05",
							group: "american",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path === "local/personal/american/2024.json") {
				return JSON.stringify({
					"2024-05-05 Test Session": { position: 42, duration: 99 },
				});
			}
			return "";
		});
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return path === "/local/sync/groups.json" || path === "local/personal";
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [] });
			}
			if (path === "local/personal/broken.json") {
				return "not json";
			}
			return "";
		});
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/american.json" ||
				path === "/local/sync/bundle.json" ||
				path === "local/personal"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({
					groups: [
						{ name: "american" },
						{ name: "bundledgroup", bundled: true },
					],
				});
			}
			if (path === "/local/sync/american.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-01-01 Merged Session",
							name: "Merged Session",
							date: "2024-01-01",
							group: "american",
							year: "2024",
							type: "video",
						},
					],
				});
			}
			if (path === "/local/sync/bundle.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-02-02 Bundled Session",
							name: "Bundled Session",
							date: "2024-02-02",
							group: "bundledgroup",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path === "local/personal/american.json") {
				return JSON.stringify({
					"2024/2024-01-01 Merged Session.json": {
						position: 11,
						duration: 22,
					},
				});
			}
			if (path === "local/personal/bundle.json") {
				return JSON.stringify({
					"bundledgroup/2024/2024-02-02 Bundled Session.json": {
						position: 33,
						duration: 44,
					},
				});
			}
			return "";
		});
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return path === "/local/sync/groups.json" || path === "local/personal";
		});
		asMock(storage.readFile).mockResolvedValue(
			JSON.stringify({ groups: [{ name: "american" }] }),
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json" ||
				path === "local/personal"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-01-01 Session",
							name: "Session",
							date: "2024-01-01",
							group: "american",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path.includes("weird/extra/deep.json")) {
				return JSON.stringify({ "2024/session": { position: 5 } });
			}
			return "";
		});
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
