import { formatUpdatedDuration, formatUpdatedTime } from "./time";

describe("formatUpdatedTime", () => {
	it("shows only seconds when under a minute", () => {
		expect(formatUpdatedTime(45)).toBe("Updated 45 seconds ago");
	});

	it("shows only seconds for a singular second", () => {
		expect(formatUpdatedTime(1)).toBe("Updated 1 second ago");
	});

	it("shows only minutes when there are no seconds remaining", () => {
		expect(formatUpdatedTime(120)).toBe("Updated 2 minutes ago");
	});

	it("shows only hours when there are no minutes remaining", () => {
		expect(formatUpdatedTime(7200)).toBe("Updated 2 hours ago");
	});

	it("prefers hours over minutes and seconds when present", () => {
		expect(formatUpdatedTime(3661)).toBe("Updated 1 hour ago");
	});
});

describe("formatUpdatedDuration", () => {
	it("joins hours, minutes and seconds with a comma-separated list", () => {
		expect(formatUpdatedDuration(3661)).toBe(
			"Updates every hour, minute, and second",
		);
	});

	it("omits zero-value units", () => {
		expect(formatUpdatedDuration(120)).toBe("Updates every 2 minutes");
	});

	it("uses a plain 'and' when there are only two units", () => {
		expect(formatUpdatedDuration(3720)).toBe(
			"Updates every hour and 2 minutes",
		);
	});

	it("shows only seconds when under a minute", () => {
		expect(formatUpdatedDuration(30)).toBe("Updates every 30 seconds");
	});
});
