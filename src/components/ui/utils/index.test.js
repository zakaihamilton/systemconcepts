import { fireEvent, render, screen } from "@testing-library/react";
import {
	ButtonGroup,
	ClickAwayListener,
	Collapse,
	CssBaseline,
	Fade,
	Grow,
	MenuList,
	NoSsr,
	Popper,
	Slide,
	Zoom,
} from "./index";

describe("ui utils", () => {
	it("Popper returns null when closed or missing an anchor", () => {
		const { container, rerender } = render(
			<Popper open={false} anchorEl={document.createElement("div")}>
				content
			</Popper>,
		);
		expect(container).toBeEmptyDOMElement();

		rerender(
			<Popper open anchorEl={null}>
				content
			</Popper>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("Popper portals children when open", () => {
		const anchor = document.createElement("div");
		anchor.getBoundingClientRect = () => ({
			top: 0,
			left: 0,
			bottom: 10,
			right: 10,
			height: 10,
			width: 10,
		});
		document.body.appendChild(anchor);

		render(
			<Popper open anchorEl={anchor} className="pop" style={{ color: "red" }}>
				popped
			</Popper>,
		);
		expect(screen.getByText("popped")).toBeInTheDocument();
		anchor.remove();
	});

	it("ClickAwayListener invokes onClickAway for outside clicks", () => {
		const onClickAway = jest.fn();
		render(
			<>
				<div data-testid="outside">out</div>
				<ClickAwayListener onClickAway={onClickAway}>
					<div data-testid="inside">in</div>
				</ClickAwayListener>
			</>,
		);

		fireEvent.mouseDown(screen.getByTestId("inside"));
		expect(onClickAway).not.toHaveBeenCalled();

		fireEvent.mouseDown(screen.getByTestId("outside"));
		expect(onClickAway).toHaveBeenCalled();
	});

	it("NoSsr renders children only after mount", () => {
		const { container } = render(
			<NoSsr>
				<span>ready</span>
			</NoSsr>,
		);
		expect(screen.getByText("ready")).toBeInTheDocument();
		expect(container.querySelector("span")).toHaveTextContent("ready");
	});

	it("Fade/Zoom/Grow toggle opacity and transform", () => {
		const { rerender } = render(
			<>
				<Fade in={false}>
					<span>fade</span>
				</Fade>
				<Zoom in={false}>
					<span>zoom</span>
				</Zoom>
				<Grow in={false}>
					<span>grow</span>
				</Grow>
			</>,
		);
		expect(screen.getByText("fade").parentElement.style.opacity).toBe("0");
		expect(screen.getByText("zoom").parentElement.style.transform).toBe(
			"scale(0)",
		);
		expect(screen.getByText("grow").parentElement.style.transform).toBe(
			"scale(0.75)",
		);

		rerender(
			<>
				<Fade in timeout={100}>
					<span>fade</span>
				</Fade>
				<Zoom in timeout={100}>
					<span>zoom</span>
				</Zoom>
				<Grow in>
					<span>grow</span>
				</Grow>
			</>,
		);
		expect(screen.getByText("fade").parentElement.style.opacity).toBe("1");
		expect(screen.getByText("zoom").parentElement.style.transform).toBe(
			"scale(1)",
		);
		expect(screen.getByText("grow").parentElement.style.transform).toBe(
			"scale(1)",
		);
	});

	it("Collapse can unmount when closed", () => {
		const { container, rerender } = render(
			<Collapse in={false} unmountOnExit>
				<span>hidden</span>
			</Collapse>,
		);
		expect(container).toBeEmptyDOMElement();

		rerender(
			<Collapse in timeout={50}>
				<span>visible</span>
			</Collapse>,
		);
		expect(screen.getByText("visible")).toBeInTheDocument();

		rerender(
			<Collapse in={false} timeout={50}>
				<span>collapsed</span>
			</Collapse>,
		);
		expect(screen.getByText("collapsed").parentElement.style.maxHeight).toBe(
			"0",
		);
	});

	it("Slide supports each direction when closed", () => {
		const { rerender } = render(
			<Slide in={false} direction="up">
				<span>s</span>
			</Slide>,
		);
		expect(screen.getByText("s").parentElement.style.transform).toBe(
			"translateY(100%)",
		);

		rerender(
			<Slide in={false} direction="down">
				<span>s</span>
			</Slide>,
		);
		expect(screen.getByText("s").parentElement.style.transform).toBe(
			"translateY(-100%)",
		);

		rerender(
			<Slide in={false} direction="left">
				<span>s</span>
			</Slide>,
		);
		expect(screen.getByText("s").parentElement.style.transform).toBe(
			"translateX(100%)",
		);

		rerender(
			<Slide in={false} direction="right" timeout={10}>
				<span>s</span>
			</Slide>,
		);
		expect(screen.getByText("s").parentElement.style.transform).toBe(
			"translateX(-100%)",
		);

		rerender(
			<Slide in>
				<span>s</span>
			</Slide>,
		);
		expect(screen.getByText("s").parentElement.style.transform).toBe("none");
	});

	it("MenuList, ButtonGroup, and CssBaseline render", () => {
		render(
			<>
				<MenuList className="ml">
					<li>one</li>
				</MenuList>
				<ButtonGroup className="bg" data-testid="bg">
					<button type="button">a</button>
				</ButtonGroup>
				<CssBaseline />
			</>,
		);
		expect(screen.getByRole("menu")).toHaveClass("ml");
		expect(screen.getByTestId("bg")).toHaveStyle({ display: "inline-flex" });
	});
});
