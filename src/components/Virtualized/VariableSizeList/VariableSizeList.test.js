import { act, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import VariableSizeList from "./VariableSizeList.js";

const Row = ({ index, style, data }) => (
	<div data-testid={`item-${index}`} style={style}>
		{data[index]}
	</div>
);

describe("VariableSizeList Component", () => {
	const itemData = ["Item 0", "Item 1", "Item 2", "Item 3"];
	const getItemSize = (index) => (index % 2 === 0 ? 50 : 100);

	it("renders variable height items", () => {
		const onScroll = jest.fn();
		const onItemsRendered = jest.fn();
		const { getByTestId, container } = render(
			<VariableSizeList
				height={150}
				width={100}
				itemCount={itemData.length}
				itemSize={getItemSize}
				itemData={itemData}
				overscanCount={1}
				onScroll={onScroll}
				onItemsRendered={onItemsRendered}
			>
				{Row}
			</VariableSizeList>,
		);

		expect(getByTestId("item-0")).toBeInTheDocument();
		expect(getByTestId("item-1")).toBeInTheDocument();
		expect(getByTestId("item-2")).toBeInTheDocument();
		expect(onItemsRendered).toHaveBeenLastCalledWith({
			visibleStartIndex: 0,
			visibleStopIndex: 2,
			overscanStartIndex: 0,
			overscanStopIndex: 3,
		});
		const scrollContainer = container.firstChild;
		Object.defineProperty(scrollContainer, "scrollTop", {
			configurable: true,
			writable: true,
			value: 60,
		});
		fireEvent.scroll(scrollContainer);
		expect(onScroll).toHaveBeenCalledWith({
			scrollOffset: 60,
			scrollUpdateWasRequested: false,
		});
	});

	it("supports scrolling and imperative refs", () => {
		const ref = createRef();
		const { container } = render(
			<VariableSizeList
				ref={ref}
				height={150}
				width={100}
				itemCount={itemData.length}
				itemSize={getItemSize}
				itemData={itemData}
				overscanCount={1}
			>
				{Row}
			</VariableSizeList>,
		);

		expect(ref.current).toBeDefined();
		expect(typeof ref.current.scrollTo).toBe("function");
		expect(typeof ref.current.scrollToItem).toBe("function");
		expect(typeof ref.current.resetAfterIndex).toBe("function");

		const scrollContainer = container.firstChild;
		fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
	});

	it("scrollToItem with start align jumps to the item top", () => {
		const ref = createRef();
		const { container } = render(
			<VariableSizeList
				ref={ref}
				height={150}
				width={100}
				itemCount={itemData.length}
				itemSize={getItemSize}
				itemData={itemData}
				overscanCount={1}
			>
				{Row}
			</VariableSizeList>,
		);

		const scrollContainer = container.firstChild;
		Object.defineProperty(scrollContainer, "scrollTop", {
			configurable: true,
			writable: true,
			value: 0,
		});

		// Item sizes: 50, 100, 50, 100 → item 2 starts at 150
		act(() => {
			ref.current.scrollToItem(2, "start");
		});
		expect(scrollContainer.scrollTop).toBe(150);

		// Already near the item; start align should still pin to top
		scrollContainer.scrollTop = 140;
		act(() => {
			ref.current.scrollToItem(2, "start");
		});
		expect(scrollContainer.scrollTop).toBe(150);
	});

	it("supports end, center, and auto scrollToItem alignments", () => {
		const ref = createRef();
		const { container } = render(
			<VariableSizeList
				ref={ref}
				height={100}
				width={100}
				itemCount={itemData.length}
				itemSize={getItemSize}
				itemData={itemData}
				overscanCount={0}
				className="vlist"
				style={{ border: "1px solid red" }}
			>
				{Row}
			</VariableSizeList>,
		);
		const scrollContainer = container.firstChild;
		Object.defineProperty(scrollContainer, "scrollTop", {
			configurable: true,
			writable: true,
			value: 0,
		});

		act(() => {
			ref.current.scrollToItem(1, "end");
		});
		expect(scrollContainer.scrollTop).toBeGreaterThanOrEqual(0);

		act(() => {
			ref.current.scrollToItem(2, "center");
		});
		expect(scrollContainer.scrollTop).toBeGreaterThanOrEqual(0);

		scrollContainer.scrollTop = 0;
		act(() => {
			ref.current.scrollToItem(3, "auto");
		});
		expect(scrollContainer.scrollTop).toBeGreaterThan(0);

		scrollContainer.scrollTop = 300;
		act(() => {
			ref.current.scrollToItem(0, "auto");
		});
		expect(scrollContainer.scrollTop).toBe(0);

		act(() => {
			ref.current.scrollTo(-10);
			ref.current.resetAfterIndex(0);
			ref.current.scrollToItem(99, "start");
		});
	});

	it("forwards an external outerRef", () => {
		const outerRef = createRef();
		render(
			<VariableSizeList
				outerRef={outerRef}
				height={100}
				width={100}
				itemCount={2}
				itemSize={() => 40}
				itemData={["a", "b"]}
			>
				{Row}
			</VariableSizeList>,
		);
		expect(outerRef.current).toBeInstanceOf(HTMLDivElement);
	});
});
