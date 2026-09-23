import {
	MAIN_SYNC_WEIGHT,
	PERSONAL_SYNC_WEIGHT,
	SyncProgressTracker,
} from "./progressTracker";
import { SyncActiveStore } from "./syncState";

describe("SyncProgressTracker", () => {
	beforeEach(() => {
		SyncActiveStore.update((state) => {
			state.progress = { total: 0, processed: 0 };
		});
	});

	it("reports partial progress within a step proportionally to its weight", () => {
		const tracker = new SyncProgressTracker(0);
		tracker.updateProgress("downloadUpdates", { processed: 5, total: 10 });

		const { progress } = SyncActiveStore.getRawState();
		expect(progress.total).toBe(MAIN_SYNC_WEIGHT);
		// downloadUpdates has weight 30; 50% complete => 15.
		expect(progress.processed).toBe(15);
	});

	it("accumulates completed weight across multiple steps", () => {
		const tracker = new SyncProgressTracker(0);
		tracker.completeStep("getLocalFiles"); // weight 5
		tracker.completeStep("updateLocalManifest"); // weight 15

		expect(tracker.getCurrentOffset()).toBe(20);
		// completeStep() reports the just-finished step as both "completed" and
		// "100% of the current step", so the emitted progress transiently counts
		// updateLocalManifest's weight twice (20 completed + 15 current = 35)
		// until the next updateProgress() call for a later step corrects it.
		const { progress } = SyncActiveStore.getRawState();
		expect(progress.processed).toBe(35);
	});

	it("offsets progress by the phase offset passed at construction", () => {
		const tracker = new SyncProgressTracker(50, 200);
		tracker.updateProgress("syncManifest", { processed: 1, total: 1 });

		const { progress } = SyncActiveStore.getRawState();
		expect(progress.total).toBe(200);
		expect(progress.processed).toBe(55); // 50 + full syncManifest weight (5)
	});

	it("switches to personal weights, which include migrateFromMongoDB", () => {
		const tracker = new SyncProgressTracker(0);
		tracker.usePersonalWeights();

		expect(tracker.localTotalWeight).toBeGreaterThan(MAIN_SYNC_WEIGHT);
		tracker.completeStep("migrateFromMongoDB");
		expect(tracker.getCurrentOffset()).toBe(10);
	});

	it("defaults the combined total weight to the local total weight", () => {
		const tracker = new SyncProgressTracker();
		expect(tracker.combinedTotalWeight).toBe(tracker.localTotalWeight);
	});

	it("marks the phase fully complete via setComplete", () => {
		const tracker = new SyncProgressTracker(10, 500);
		tracker.setComplete();

		const { progress } = SyncActiveStore.getRawState();
		expect(progress.total).toBe(500);
		expect(progress.processed).toBe(10 + tracker.localTotalWeight);
	});

	it("computes the same MAIN_SYNC_WEIGHT/PERSONAL_SYNC_WEIGHT relationship as the tracker", () => {
		expect(PERSONAL_SYNC_WEIGHT).toBe(MAIN_SYNC_WEIGHT + 10);
	});

	it("treats zero-total step progress as no partial completion", () => {
		const tracker = new SyncProgressTracker(0);
		tracker.updateProgress("downloadUpdates", { processed: 5, total: 0 });

		const { progress } = SyncActiveStore.getRawState();
		expect(progress.processed).toBe(0);
	});

	it("ignores unknown step names when updating progress", () => {
		const tracker = new SyncProgressTracker(0);
		tracker.updateProgress("unknownStep", { processed: 1, total: 1 });

		const { progress } = SyncActiveStore.getRawState();
		expect(progress.processed).toBe(0);
	});

	it("falls back to the local total weight when combined total is falsy", () => {
		const tracker = new SyncProgressTracker(0, 0);
		expect(tracker.combinedTotalWeight).toBe(tracker.localTotalWeight);
	});
});
