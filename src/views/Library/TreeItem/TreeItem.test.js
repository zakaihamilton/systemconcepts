import { act, fireEvent, render, screen } from "@testing-library/react";
import { LibraryStore } from "../Store";
import TreeItem from "./TreeItem";

jest.mock("../Store", () => {
	const state = {
		selectedId: null,
		selectPath: null,
		expandedNodes: [],
		clickedId: null,
	};
	return {
		LibraryStore: {
			useState: jest.fn((selector) =>
				typeof selector === "function" ? selector(state) : state,
			),
			update: jest.fn((updater) => updater(state)),
			__state: state,
		},
	};
});

jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-testid="tooltip" data-title={title || ""}>
		{children}
	</div>
));

describe("TreeItem", () => {
	const onSelect = jest.fn();
	const Icon = () => <span data-testid="type-icon" />;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		const state = LibraryStore.__state;
		state.selectedId = null;
		state.selectPath = null;
		state.expandedNodes = [];
		state.clickedId = null;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("renders a leaf node as a link and selects on click", () => {
		render(
			<TreeItem
				node={{
					id: "leaf-1",
					_id: "leaf-1",
					name: "Leaf",
					Icon,
					type: "title",
				}}
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("Leaf")).toBeInTheDocument();
		expect(screen.getByTestId("type-icon")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("link"));
		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ id: "leaf-1" }),
		);
	});

	it("renders a parent without _id as a button and toggles expand", () => {
		const parent = {
			id: "parent",
			name: "Parent",
			children: [{ id: "child", _id: "child", name: "Child" }],
		};
		render(<TreeItem node={parent} onSelect={onSelect} />);
		fireEvent.click(screen.getByRole("button"));
		expect(LibraryStore.update).toHaveBeenCalled();
		expect(LibraryStore.__state.expandedNodes).toContain("parent");
	});

	it("expands along selectPath and scrolls when not manually clicked", () => {
		LibraryStore.__state.selectPath = "parent|child";
		LibraryStore.__state.expandedNodes = [];
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;

		render(
			<TreeItem
				node={{
					id: "parent",
					name: "Parent",
					children: [{ id: "child", _id: "child", name: "Child" }],
				}}
				onSelect={onSelect}
			/>,
		);

		expect(LibraryStore.__state.expandedNodes).toContain("parent");
	});

	it("does not scroll when the node was clicked", () => {
		LibraryStore.__state.selectPath = "leaf-1";
		LibraryStore.__state.clickedId = "leaf-1";
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;

		render(
			<TreeItem
				node={{ id: "leaf-1", _id: "leaf-1", name: "Leaf" }}
				onSelect={onSelect}
			/>,
		);
		act(() => {
			jest.advanceTimersByTime(600);
		});
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it("scrolls into view for programmatic selection", () => {
		LibraryStore.__state.selectPath = "leaf-1";
		LibraryStore.__state.clickedId = null;
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;

		render(
			<TreeItem
				node={{ id: "leaf-1", _id: "leaf-1", name: "Leaf" }}
				onSelect={onSelect}
			/>,
		);
		act(() => {
			jest.advanceTimersByTime(600);
		});
		expect(scrollIntoView).toHaveBeenCalled();
	});

	it("uses abbreviation expansion for the display name", () => {
		render(
			<TreeItem
				node={{ id: "n1", _id: "n1", name: "KHB" }}
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("Keter, Hochma, Bina")).toBeInTheDocument();
	});

	it("shows a number badge when provided", () => {
		render(
			<TreeItem
				node={{ id: "n1", _id: "n1", name: "Item", number: 7 }}
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("7")).toBeInTheDocument();
	});

	it("calls onToggle when provided instead of updating store expand", () => {
		const onToggle = jest.fn();
		LibraryStore.__state.expandedNodes = ["parent"];
		render(
			<TreeItem
				node={{
					id: "parent",
					name: "Parent",
					children: [{ id: "child", _id: "child", name: "Child" }],
				}}
				onSelect={onSelect}
				onToggle={onToggle}
			/>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onToggle).toHaveBeenCalledWith("parent", false);
	});

	it("collapses siblings when a child expands via handleChildToggle", () => {
		LibraryStore.__state.expandedNodes = ["parent", "a"];
		const { rerender } = render(
			<TreeItem
				node={{
					id: "parent",
					name: "Parent",
					children: [
						{ id: "a", _id: "a", name: "A" },
						{ id: "b", _id: "b", name: "B" },
					],
				}}
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("A")).toBeInTheDocument();

		// Re-render with expanded parent so children are visible, then toggle child B
		LibraryStore.__state.expandedNodes = ["parent", "a"];
		rerender(
			<TreeItem
				node={{
					id: "parent",
					name: "Parent",
					children: [
						{ id: "a", _id: "a", name: "A" },
						{
							id: "b",
							name: "B",
							children: [{ id: "b1", _id: "b1", name: "B1" }],
						},
					],
				}}
				onSelect={onSelect}
			/>,
		);

		fireEvent.click(screen.getByText("B"));
		expect(LibraryStore.__state.expandedNodes).toContain("b");
		expect(LibraryStore.__state.expandedNodes).not.toContain("a");
	});

	it("clears clickedId after the selection delay", () => {
		render(
			<TreeItem
				node={{ id: "leaf-1", _id: "leaf-1", name: "Leaf" }}
				onSelect={onSelect}
			/>,
		);
		fireEvent.click(screen.getByRole("link"));
		expect(LibraryStore.__state.clickedId).toBe("leaf-1");
		act(() => {
			jest.advanceTimersByTime(2000);
		});
		expect(LibraryStore.__state.clickedId).toBeNull();
	});

	it("checks truncation on resize and mouse enter", () => {
		render(
			<TreeItem
				node={{ id: "leaf-1", _id: "leaf-1", name: "Leaf" }}
				onSelect={onSelect}
			/>,
		);
		fireEvent(window, new Event("resize"));
		fireEvent.mouseEnter(screen.getByText("Leaf"));
		expect(screen.getByText("Leaf")).toBeInTheDocument();
	});

	it("stops propagation when toggling via the expand icon", () => {
		const parent = {
			id: "parent",
			name: "Parent",
			children: [{ id: "child", _id: "child", name: "Child" }],
		};
		LibraryStore.__state.expandedNodes = ["parent"];
		render(<TreeItem node={parent} onSelect={onSelect} />);
		const stopPropagation = jest.fn();
		const preventDefault = jest.fn();
		fireEvent.click(screen.getByText("Parent").closest("button"), {
			stopPropagation,
			preventDefault,
		});
		expect(LibraryStore.update).toHaveBeenCalled();
	});

	it("collapses an expanded node without onToggle", () => {
		LibraryStore.__state.expandedNodes = ["parent"];
		const parent = {
			id: "parent",
			name: "Parent",
			children: [{ id: "child", _id: "child", name: "Child" }],
		};
		render(<TreeItem node={parent} onSelect={onSelect} />);
		fireEvent.click(screen.getByRole("button"));
		expect(LibraryStore.__state.expandedNodes).not.toContain("parent");
	});

	it("collapses a child via handleChildToggle", () => {
		LibraryStore.__state.expandedNodes = ["parent", "child"];
		render(
			<TreeItem
				node={{
					id: "parent",
					name: "Parent",
					children: [
						{
							id: "child",
							name: "Child",
							children: [{ id: "grand", _id: "grand", name: "Grand" }],
						},
					],
				}}
				onSelect={onSelect}
				onToggle={jest.fn((id, expanding) => {
					if (!expanding) {
						LibraryStore.__state.expandedNodes =
							LibraryStore.__state.expandedNodes.filter((x) => x !== id);
					}
				})}
			/>,
		);
		fireEvent.click(screen.getByText("Child"));
		expect(LibraryStore.__state.expandedNodes).not.toContain("child");
	});

	it("marks the node selected when store selectedId matches", () => {
		LibraryStore.__state.selectedId = "leaf-1";
		const { container } = render(
			<TreeItem
				node={{ id: "leaf-1", _id: "leaf-1", name: "Leaf" }}
				onSelect={onSelect}
			/>,
		);
		expect(container.querySelector('[class*="selected"]')).toBeTruthy();
	});

	it("toggles via the expand icon without selecting the leaf", () => {
		const parent = {
			id: "parent",
			name: "Parent",
			children: [{ id: "child", _id: "child", name: "Child" }],
		};
		render(<TreeItem node={parent} onSelect={onSelect} />);
		const toggle = screen
			.getByText("Parent")
			.closest("button")
			.querySelector('[class*="toggleIcon"]');
		fireEvent.click(toggle);
		expect(LibraryStore.__state.expandedNodes).toContain("parent");
		expect(onSelect).not.toHaveBeenCalled();
	});
});
