import { render, screen } from "@testing-library/react";
import Avatar from "./Avatar";

describe("Avatar", () => {
	it("renders an image when src is provided", () => {
		render(<Avatar src="/a.png" alt="Ada" className="av" data-testid="av" />);
		const img = screen.getByRole("img", { name: "Ada" });
		expect(img).toHaveAttribute("src", "/a.png");
		expect(img).toHaveClass("av");
	});

	it("defaults alt to an empty string", () => {
		const { container } = render(<Avatar src="/b.png" />);
		expect(container.querySelector("img")).toHaveAttribute("alt", "");
	});

	it("renders children in a span when there is no src", () => {
		render(
			<Avatar className="initials" data-testid="span-av">
				ZH
			</Avatar>,
		);
		expect(screen.getByTestId("span-av").tagName).toBe("SPAN");
		expect(screen.getByTestId("span-av")).toHaveTextContent("ZH");
		expect(screen.getByTestId("span-av")).toHaveClass("initials");
	});
});
