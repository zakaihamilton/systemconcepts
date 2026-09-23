import { logger as structuredLogger } from "@util/api/logger";
import { addSyncLog } from "./logs";
import { SyncActiveStore } from "./syncState";

describe("addSyncLog", () => {
	beforeEach(() => {
		SyncActiveStore.update((state) => {
			state.logs = [];
			state.debugLevel = "info";
		});
	});

	it("appends an info log entry visible to the UI", () => {
		addSyncLog("Step complete", "info");

		const { logs } = SyncActiveStore.getRawState();
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({ message: "Step complete", type: "info" });
		expect(typeof logs[0].timestamp).toBe("number");
	});

	it("routes error-typed messages through logger.error", () => {
		const spy = jest
			.spyOn(structuredLogger, "error")
			.mockImplementation(() => {});
		addSyncLog("Something broke", "error");
		expect(spy).toHaveBeenCalledWith("[Sync] Something broke");
		spy.mockRestore();
	});

	it("routes warning-typed messages through logger.warn", () => {
		const spy = jest
			.spyOn(structuredLogger, "warn")
			.mockImplementation(() => {});
		addSyncLog("Careful", "warning");
		expect(spy).toHaveBeenCalledWith("[Sync] Careful");
		spy.mockRestore();
	});

	it("suppresses verbose logs from the UI unless verbose debugging is enabled", () => {
		addSyncLog("Chatty detail", "verbose");

		expect(SyncActiveStore.getRawState().logs).toHaveLength(0);
	});

	it("includes verbose logs in the UI once verbose debugging is enabled", () => {
		SyncActiveStore.update((state) => {
			state.debugLevel = "verbose";
		});

		addSyncLog("Chatty detail", "verbose");

		expect(SyncActiveStore.getRawState().logs).toHaveLength(1);
	});

	it("keeps only the most recent 300 log entries", () => {
		for (let i = 0; i < 305; i++) {
			addSyncLog(`entry-${i}`, "info");
		}

		const { logs } = SyncActiveStore.getRawState();
		expect(logs).toHaveLength(300);
		expect(logs[0].message).toBe("entry-5");
		expect(logs[299].message).toBe("entry-304");
	});

	it("routes default info messages through logger.debug", () => {
		const spy = jest
			.spyOn(structuredLogger, "debug")
			.mockImplementation(() => {});
		addSyncLog("Routine update");
		expect(spy).toHaveBeenCalledWith("[Sync] Routine update");
		spy.mockRestore();
	});

	it("logs verbose messages to the console when verbose mode is off", () => {
		const spy = jest
			.spyOn(structuredLogger, "debug")
			.mockImplementation(() => {});
		addSyncLog("Hidden detail", "verbose");
		expect(spy).toHaveBeenCalledWith("[Sync-Verbose] Hidden detail");
		spy.mockRestore();
	});
});
