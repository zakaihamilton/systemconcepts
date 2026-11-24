export const mockResearchListState = {
	scrollToItem: jest.fn(),
	resetAfterIndex: jest.fn(),
	latestProps: null as any,
};

export function mockResearchListFactory() {
	const React = require("react");
	return React.forwardRef(function MockList(props: any, ref: any) {
		mockResearchListState.latestProps = props;
		React.useImperativeHandle(ref, () => ({
			scrollToItem: mockResearchListState.scrollToItem,
			resetAfterIndex: mockResearchListState.resetAfterIndex,
		}));
		return <div data-testid="virtual-list" />;
	});
}

jest.mock(
	"./PageIndicator",
	() =>
		({ current, total, visible, label, onClick }: any) =>
			visible ? (
				<button type="button" onClick={onClick} aria-haspopup="menu">
					{label} {current} / {total}
				</button>
			) : null,
);
jest.mock(
	"./ResultsOutline",
	() =>
		({ open, results, onSelect, currentIndex }: any) =>
			open ? (
				<div role="menu" aria-label="Results list">
					{results.map((doc: any, index: any) => (
						<button
							key={doc.docId || index}
							type="button"
							role="menuitem"
							aria-current={index === currentIndex ? "true" : undefined}
							onClick={() => onSelect(index)}
						>
							{doc.tag?.title || doc.name}
						</button>
					))}
				</div>
			) : null,
);
jest.mock("./SearchResultItem", () => () => (
	<div data-testid="search-result-item" />
));
jest.mock(
	"@views/Library/Article/JumpDialog",
	() => (props: any) =>
		props.open ? (
			<div data-testid="jump-dialog">
				<button type="button" onClick={() => props.onSubmit("page", 2)}>
					jump-page
				</button>
				<button type="button" onClick={() => props.onSubmit("paragraph", 2)}>
					jump-match
				</button>
			</div>
		) : null,
);
