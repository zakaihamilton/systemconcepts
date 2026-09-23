import { getAnchorPosition } from "./position";

function rect({
	top = 10,
	left = 20,
	bottom = 40,
	right = 80,
	height = 30,
	width = 60,
} = {}) {
	return {
		getBoundingClientRect: () => ({ top, left, bottom, right, height, width }),
	};
}

describe("getAnchorPosition", () => {
	it("defaults to bottom-left anchor and top-left transform", () => {
		expect(getAnchorPosition(rect())).toEqual({
			position: "fixed",
			zIndex: 1300,
			top: 44,
			left: 20,
		});
	});

	it("supports top and right anchor origins", () => {
		expect(
			getAnchorPosition(rect(), {
				vertical: "top",
				horizontal: "right",
			}),
		).toEqual({
			position: "fixed",
			zIndex: 1300,
			top: 6,
			left: 80,
		});
	});

	it("centers when vertical/horizontal origins are middle values", () => {
		expect(
			getAnchorPosition(
				rect({
					top: 0,
					left: 0,
					height: 40,
					width: 100,
					bottom: 40,
					right: 100,
				}),
				{
					vertical: "center",
					horizontal: "center",
				},
			),
		).toEqual({
			position: "fixed",
			zIndex: 1300,
			top: 20,
			left: 50,
		});
	});

	it("applies transform origins for right and bottom", () => {
		expect(
			getAnchorPosition(
				rect(),
				{ vertical: "bottom", horizontal: "left" },
				{ vertical: "bottom", horizontal: "right" },
			),
		).toEqual({
			position: "fixed",
			zIndex: 1300,
			top: 44,
			left: 20,
			transform: "translateX(-100%) translateY(-100%)",
		});
	});

	it("applies only vertical transform when horizontal is not right", () => {
		expect(
			getAnchorPosition(
				rect(),
				{ vertical: "bottom", horizontal: "left" },
				{ vertical: "bottom", horizontal: "left" },
			).transform,
		).toBe(" translateY(-100%)");
	});
});
