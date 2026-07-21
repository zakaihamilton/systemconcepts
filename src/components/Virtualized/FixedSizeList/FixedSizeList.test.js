import { fireEvent, render } from "@testing-library/react";
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
			</FixedSizeList>,
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
			</FixedSizeList>,
		);

		const scrollContainer = container.firstChild;
		Object.defineProperty(scrollContainer, "scrollTop", {
			configurable: true,
			value: 50,
		});
		fireEvent.scroll(scrollContainer, {
			currentTarget: { scrollTop: 50, scrollLeft: 0 },
		});

		expect(onScroll).toHaveBeenCalledWith({
			scrollOffset: 50,
			scrollUpdateWasRequested: false,
		});
	});

	it("supports imperative vertical scrollTo and scrollToItem alignments", () => {
		const ref = createRef();
		const { container } = render(
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
			</FixedSizeList>,
		);

		const el = container.firstChild;
		Object.defineProperty(el, "scrollTop", {
			configurable: true,
			writable: true,
			value: 0,
		});

		ref.current.scrollTo(75);
		expect(el.scrollTop).toBe(75);

		ref.current.scrollToItem(2, "start");
		expect(el.scrollTop).toBe(100);

		ref.current.scrollToItem(2, "end");
		expect(el.scrollTop).toBe(50);

		ref.current.scrollToItem(2, "center");
		expect(el.scrollTop).toBe(75);

		el.scrollTop = 0;
		ref.current.scrollToItem(3, "auto");
		expect(el.scrollTop).toBe(100);

		el.scrollTop = 200;
		ref.current.scrollToItem(0, "auto");
		expect(el.scrollTop).toBe(0);

		el.scrollTop = 50;
		ref.current.scrollToItem(1, "auto");
		expect(el.scrollTop).toBe(50);
	});

	it("supports horizontal layout, external outerRef, and initialScrollOffset", () => {
		const onScroll = jest.fn();
		const onItemsRendered = jest.fn();
		const outerRef = { current: null };
		const ref = createRef();
		const { container } = render(
			<FixedSizeList
				ref={ref}
				layout="horizontal"
				height={50}
				width={100}
				itemCount={itemData.length}
				itemSize={40}
				itemData={itemData}
				overscanCount={0}
				initialScrollOffset={40}
				outerRef={outerRef}
				onScroll={onScroll}
				onItemsRendered={onItemsRendered}
				className="list"
				style={{ border: "1px solid red" }}
				innerElementType="section"
			>
				{Row}
			</FixedSizeList>,
		);

		expect(outerRef.current).toBe(container.firstChild);
		Object.defineProperty(outerRef.current, "scrollLeft", {
			configurable: true,
			writable: true,
			value: 0,
		});

		ref.current.scrollTo(80);
		expect(outerRef.current.scrollLeft).toBe(80);

		ref.current.scrollToItem(1, "start");
		expect(outerRef.current.scrollLeft).toBe(40);

		fireEvent.scroll(outerRef.current, {
			currentTarget: { scrollTop: 0, scrollLeft: 40 },
		});
		expect(onScroll).toHaveBeenCalledWith({
			scrollOffset: 40,
			scrollUpdateWasRequested: false,
		});
	});

	it("works without onScroll and onItemsRendered", () => {
		const { container } = render(
			<FixedSizeList
				height={100}
				width={100}
				itemCount={2}
				itemSize={50}
				itemData={itemData}
			>
				{Row}
			</FixedSizeList>,
		);
		fireEvent.scroll(container.firstChild, {
			currentTarget: { scrollTop: 10, scrollLeft: 0 },
		});
		expect(container.firstChild).toBeTruthy();
	});
});
