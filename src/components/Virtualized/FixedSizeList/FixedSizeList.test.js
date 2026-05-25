import { render, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import FixedSizeList from "./FixedSizeList.js";

const Row = ({ index, style, data }) => (
	<div data-testid={`item-${index}`} style={style}>
		{data[index]}
	</div>
);

describe("FixedSizeList Component", () => {
	const itemData = ["Item 0", "Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];

	it("renders visible items and handles overscan", () => {
		const onItemsRendered = jest.fn();
		const { getByTestId, queryByTestId } = render(
			<FixedSizeList
				height={100}
				width={100}
				itemCount={itemData.length}
				itemSize={50}
				itemData={itemData}
				overscanCount={1}
				onItemsRendered={onItemsRendered}
			>
				{Row}
			</FixedSizeList>
		);

		expect(getByTestId("item-0")).toBeInTheDocument();
		expect(getByTestId("item-1")).toBeInTheDocument();
		expect(getByTestId("item-2")).toBeInTheDocument();
		expect(getByTestId("item-3")).toBeInTheDocument();
		expect(queryByTestId("item-4")).not.toBeInTheDocument();

		expect(onItemsRendered).toHaveBeenCalledWith({
			visibleStartIndex: 0,
			visibleStopIndex: 2,
			overscanStartIndex: 0,
			overscanStopIndex: 3,
		});
	});

	it("handles scrolling correctly", () => {
		const onScroll = jest.fn();
		const { container } = render(
			<FixedSizeList
				height={100}
				width={100}
				itemCount={itemData.length}
				itemSize={50}
				itemData={itemData}
				overscanCount={1}
				onScroll={onScroll}
			>
				{Row}
			</FixedSizeList>
		);

		const scrollContainer = container.firstChild;
		fireEvent.scroll(scrollContainer, { target: { scrollTop: 50 } });

		expect(onScroll).toHaveBeenCalledWith({
			scrollOffset: 50,
			scrollUpdateWasRequested: false,
		});
	});

	it("supports imperative ref scrollTo and scrollToItem", () => {
		const ref = createRef();
		render(
			<FixedSizeList
				ref={ref}
				height={100}
				width={100}
				itemCount={itemData.length}
				itemSize={50}
				itemData={itemData}
				overscanCount={1}
			>
				{Row}
			</FixedSizeList>
		);

		expect(ref.current).toBeDefined();
		expect(typeof ref.current.scrollTo).toBe("function");
		expect(typeof ref.current.scrollToItem).toBe("function");
	});
});
