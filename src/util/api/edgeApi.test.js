import { enforceRateLimitEdge } from "./edgeApi";

describe("enforceRateLimitEdge", () => {
	it("bypasses external rate-limit persistence only in the Playwright harness", async () => {
		const previous = process.env.PLAYWRIGHT;
		process.env.PLAYWRIGHT = "1";
		await expect(enforceRateLimitEdge("203.0.113.1")).resolves.toBe(true);
		if (previous === undefined) delete process.env.PLAYWRIGHT;
		else process.env.PLAYWRIGHT = previous;
	});
});
