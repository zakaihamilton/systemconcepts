import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import FixedSizeGrid from "./FixedSizeGrid.js";

const Cell = ({ rowIndex, columnIndex, style, data }) => (
	<div data-testid={`cell-${rowIndex}-${columnIndex}`} style={style}>
		{data?.[`${rowIndex}-${columnIndex}`]}
	</div>
);

describe("FixedSizeGrid Component", () => {
	const itemData = {
		"0-0": "Cell 0,0",
		"0-1": "Cell 0,1",
		"1-0": "Cell 1,0",
		"1-1": "Cell 1,1",
	};

	it("renders grid items", () => {
		const onScroll = jest.fn();
		const { getByTestId } = render(
			<FixedSizeGrid
				columnCount={2}
				columnWidth={50}
				rowCount={2}
				rowHeight={50}
				height={100}
				width={100}
				itemData={itemData}
				onScroll={onScroll}
			>
				{Cell}
			</FixedSizeGrid>,
		);

		expect(getByTestId("cell-0-0")).toBeInTheDocument();
		expect(getByTestId("cell-0-1")).toBeInTheDocument();
		expect(getByTestId("cell-1-0")).toBeInTheDocument();
		expect(getByTestId("cell-1-1")).toBeInTheDocument();
	});

	it("supports scrolling and updates layout", () => {
		const onScroll = jest.fn();
		const { container } = render(
			<FixedSizeGrid
				columnCount={4}
				columnWidth={50}
				rowCount={4}
				rowHeight={50}
				height={100}
				width={100}
				itemData={itemData}
				onScroll={onScroll}
			>
				{Cell}
			</FixedSizeGrid>,
		);

		const scrollContainer = container.firstChild;
		fireEvent.scroll(scrollContainer, {
			target: { scrollTop: 50, scrollLeft: 50 },
		});

		expect(onScroll).toHaveBeenCalledWith({
			scrollTop: 50,
			scrollLeft: 50,
			scrollUpdateWasRequested: false,
		});
	});

	it("supports imperative ref scrollTo for left and top", () => {
		const ref = createRef();
		const { container } = render(
			<FixedSizeGrid
				ref={ref}
				columnCount={4}
				columnWidth={50}
				rowCount={4}
				rowHeight={50}
				height={100}
				width={100}
				itemData={itemData}
				initialScrollTop={25}
				overscanRowCount={2}
				overscanColumnCount={1}
				className="grid"
				style={{ border: "1px solid" }}
			>
				{Cell}
			</FixedSizeGrid>,
		);

		expect(ref.current).toBeDefined();
		const scrollContainer = container.firstChild;
		Object.defineProperty(scrollContainer, "scrollLeft", {
			writable: true,
			value: 0,
		});
		Object.defineProperty(scrollContainer, "scrollTop", {
			writable: true,
			value: 0,
		});

		ref.current.scrollTo({ scrollLeft: 40, scrollTop: 60 });
		expect(scrollContainer.scrollLeft).toBe(40);
		expect(scrollContainer.scrollTop).toBe(60);

		ref.current.scrollTo({});
		ref.current.scrollTo({ scrollLeft: 10 });
		expect(scrollContainer.scrollLeft).toBe(10);
	});

	it("works without an onScroll callback", () => {
		const { container } = render(
			<FixedSizeGrid
				columnCount={2}
				columnWidth={50}
				rowCount={2}
				rowHeight={50}
				height={100}
				width={100}
			>
				{Cell}
			</FixedSizeGrid>,
		);
		fireEvent.scroll(container.firstChild, {
			target: { scrollTop: 10, scrollLeft: 5 },
		});
		expect(screen.getByTestId("cell-0-0")).toBeInTheDocument();
	});

	it("no-ops scrollTo after the grid unmounts", () => {
		let scrollTo;
		const ref = (instance) => {
			if (instance) {
				scrollTo = instance.scrollTo;
			}
		};
		const { unmount } = render(
			<FixedSizeGrid
				ref={ref}
				columnCount={2}
				columnWidth={50}
				rowCount={2}
				rowHeight={50}
				height={100}
				width={100}
			>
				{Cell}
			</FixedSizeGrid>,
		);
		unmount();
		expect(() => scrollTo({ scrollLeft: 5, scrollTop: 5 })).not.toThrow();
	});
});
