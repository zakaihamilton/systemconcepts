import {
	clampToViewport,
	getTooltipBox,
	getTooltipPosition,
} from "./positioning";

const viewport = { width: 400, height: 300 };

describe("tooltip positioning", () => {
	it("centers a top tooltip above the anchor", () => {
		const position = getTooltipPosition(
			{ top: 100, left: 100, right: 140, bottom: 120, width: 40, height: 20 },
			{ width: 80, height: 24 },
			"top",
			viewport,
		);

		expect(position).toEqual({ top: 68, left: 80 });
	});

	it("positions a left tooltip to the left of the anchor", () => {
		const position = getTooltipPosition(
			{ top: 100, left: 100, right: 140, bottom: 120, width: 40, height: 20 },
			{ width: 80, height: 24 },
			"left",
			viewport,
		);

		expect(position).toEqual({ top: 98, left: 12 });
	});

	it("clamps a tooltip that would overflow the right edge", () => {
		const position = getTooltipPosition(
			{ top: 100, left: 360, right: 390, bottom: 120, width: 30, height: 20 },
			{ width: 80, height: 24 },
			"top",
			viewport,
		);

		expect(position.left).toBe(312);
	});

	it("clamps a tooltip that would overflow the top edge", () => {
		const position = getTooltipPosition(
			{ top: 10, left: 100, right: 140, bottom: 30, width: 40, height: 20 },
			{ width: 80, height: 24 },
			"top",
			viewport,
		);

		expect(position.top).toBe(8);
	});

	it("clamps a tooltip that would overflow the bottom edge", () => {
		const box = getTooltipBox(
			{ top: 280, left: 100, right: 140, bottom: 300, width: 40, height: 20 },
			{ width: 80, height: 24 },
			"bottom",
		);

		expect(clampToViewport(box, { width: 80, height: 24 }, viewport)).toEqual({
			top: 268,
			left: 80,
		});
	});
});
