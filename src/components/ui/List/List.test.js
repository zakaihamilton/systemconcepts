import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { ListItemButton } from "./List.js";

describe("ListItemButton", () => {
	it("renders a button by default", () => {
		const { getByRole } = render(
			<ListItemButton onClick={jest.fn()}>Item</ListItemButton>,
		);
		expect(getByRole("button", { name: "Item" })).toBeInTheDocument();
	});

	it("renders a custom component with href when component is provided", () => {
		const Link = ({ href, children, ...props }) => (
			<a href={href} {...props}>
				{children}
			</a>
		);

		const { getByRole } = render(
			<ListItemButton component={Link} href="#research">
				Research
			</ListItemButton>,
		);

		const link = getByRole("link", { name: "Research" });
		expect(link).toHaveAttribute("href", "#research");
	});

	it("forwards ref to the rendered element", () => {
		const ref = createRef();
		render(<ListItemButton ref={ref}>Item</ListItemButton>);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it("forwards underline and color to custom components", () => {
		const Link = ({ href, children, underline, color, ...props }) => (
			<a href={href} data-underline={underline} data-color={color} {...props}>
				{children}
			</a>
		);

		const { getByRole } = render(
			<ListItemButton
				component={Link}
				href="#library"
				underline="none"
				color="inherit"
			>
				Library
			</ListItemButton>,
		);

		const link = getByRole("link", { name: "Library" });
		expect(link).toHaveAttribute("data-underline", "none");
		expect(link).toHaveAttribute("data-color", "inherit");
	});

	it("calls onClick when clicked", () => {
		const handleClick = jest.fn();
		const { getByRole } = render(
			<ListItemButton onClick={handleClick}>Item</ListItemButton>,
		);
		fireEvent.click(getByRole("button", { name: "Item" }));
		expect(handleClick).toHaveBeenCalledTimes(1);
	});
});
