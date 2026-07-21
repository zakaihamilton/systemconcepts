import pLimit from "./p-limit";

describe("p-limit", () => {
	it("limits concurrent executions to the configured amount", async () => {
		const limit = pLimit(2);
		let active = 0;
		let maxActive = 0;

		const tasks = Array.from({ length: 4 }, () =>
			limit(async () => {
				active++;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 10));
				active--;
			}),
		);

		await Promise.all(tasks);
		expect(maxActive).toBeLessThanOrEqual(2);
	});

	it("continues the queue after a task rejects", async () => {
		const limit = pLimit(1);
		const results = [];

		await Promise.allSettled([
			limit(async () => {
				throw new Error("boom");
			}),
			limit(async () => {
				results.push("ok");
			}),
		]);

		expect(results).toEqual(["ok"]);
	});

	it("exposes queue helpers for active and pending work", async () => {
		const limit = pLimit(1);
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});

		const pending = limit(async () => gate);
		expect(limit.activeCount).toBe(1);

		limit(async () => "done");
		expect(limit.pendingCount).toBe(1);
		limit.clearQueue();
		expect(limit.pendingCount).toBe(0);

		release();
		await pending;
	});
});
