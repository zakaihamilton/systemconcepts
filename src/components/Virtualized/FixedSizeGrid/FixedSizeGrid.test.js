import { render, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import FixedSizeGrid from "./FixedSizeGrid.js";

const Cell = ({ rowIndex, columnIndex, style, data }) => (
	<div data-testid={`cell-${rowIndex}-${columnIndex}`} style={style}>
		{data[`${rowIndex}-${columnIndex}`]}
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
			</FixedSizeGrid>
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
			</FixedSizeGrid>
		);

		const scrollContainer = container.firstChild;
		fireEvent.scroll(scrollContainer, { target: { scrollTop: 50, scrollLeft: 50 } });

		expect(onScroll).toHaveBeenCalledWith({
			scrollTop: 50,
			scrollLeft: 50,
			scrollUpdateWasRequested: false,
		});
	});

	it("supports imperative ref scrollTo", () => {
		const ref = createRef();
		render(
			<FixedSizeGrid
				ref={ref}
				columnCount={2}
				columnWidth={50}
				rowCount={2}
				rowHeight={50}
				height={100}
				width={100}
				itemData={itemData}
			>
				{Cell}
			</FixedSizeGrid>
		);

		expect(ref.current).toBeDefined();
		expect(typeof ref.current.scrollTo).toBe("function");
	});
});
