import { fireEvent, render } from "@testing-library/react";
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
		const { getByTestId } = render(
			<VariableSizeList
				height={150}
				width={100}
				itemCount={itemData.length}
				itemSize={getItemSize}
				itemData={itemData}
				overscanCount={1}
				onScroll={onScroll}
			>
				{Row}
			</VariableSizeList>,
		);

		expect(getByTestId("item-0")).toBeInTheDocument();
		expect(getByTestId("item-1")).toBeInTheDocument();
		expect(getByTestId("item-2")).toBeInTheDocument();
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
});
