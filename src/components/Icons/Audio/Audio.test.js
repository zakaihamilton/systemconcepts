import { render } from "@testing-library/react";
import { createRef } from "react";
import AudioIcon from "./Audio.js";

describe("AudioIcon Component", () => {
	it("renders successfully", () => {
		const { container } = render(<AudioIcon />);
		const svgElement = container.querySelector("svg");
		expect(svgElement).toBeInTheDocument();
		expect(svgElement).toHaveStyle("transform: rotate(16deg)");
	});

	it("forwards ref to the underlying SVG element", () => {
		const ref = createRef();
		render(<AudioIcon ref={ref} />);
		expect(ref.current).toBeInstanceOf(SVGSVGElement);
	});
});
