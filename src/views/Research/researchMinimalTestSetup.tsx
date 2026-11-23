jest.mock("@components/Virtualized/VariableSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockList(_props: any, ref: any) {
		React.useImperativeHandle(ref, () => ({
			scrollToItem: jest.fn(),
			resetAfterIndex: jest.fn(),
		}));
		return <div data-testid="virtual-list" />;
	});
});
jest.mock("./PageIndicator", () => () => null);
jest.mock("./ResultsOutline", () => () => null);
jest.mock("./SearchResultItem", () => () => (
	<div data-testid="search-result-item" />
));
jest.mock("@views/Library/Article/JumpDialog", () => () => null);
