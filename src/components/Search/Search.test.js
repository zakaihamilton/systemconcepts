import { useToolbar } from "@components/Toolbar";
import {
	act,
	fireEvent,
	render,
	renderHook,
	screen,
} from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { SearchStore, SearchWidget, useSearch } from "./Search.js";

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock(
	"@ui/InputBase",
	() =>
		({
			inputRef,
			placeholder,
			value,
			onChange,
			onKeyDown,
			onFocus,
			onBlur,
		}) => (
			<input
				ref={inputRef}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				onKeyDown={onKeyDown}
				onFocus={onFocus}
				onBlur={onBlur}
				aria-label="search"
			/>
		),
);

describe("SearchWidget", () => {
	it("renders with placeholder and value", () => {
		render(
			<SearchWidget placeholder="Search..." value="test" onChange={() => {}} />,
		);
		expect(screen.getByPlaceholderText("Search...").value).toBe("test");
	});

	it("calls onChange when text is entered", () => {
		const onChange = jest.fn();
		render(
			<SearchWidget placeholder="Search..." value="" onChange={onChange} />,
		);
		fireEvent.change(screen.getByPlaceholderText("Search..."), {
			target: { value: "new search" },
		});
		expect(onChange).toHaveBeenCalled();
	});

	it("calls onEnter when Enter key is pressed", () => {
		const onEnter = jest.fn();
		render(
			<SearchWidget
				placeholder="Search..."
				value="test"
				onChange={() => {}}
				onEnter={onEnter}
			/>,
		);
		fireEvent.keyDown(screen.getByPlaceholderText("Search..."), {
			keyCode: 13,
		});
		expect(onEnter).toHaveBeenCalled();
	});

	it("does not call onEnter for other keys", () => {
		const onEnter = jest.fn();
		render(
			<SearchWidget
				placeholder="Search..."
				value="test"
				onChange={() => {}}
				onEnter={onEnter}
			/>,
		);
		fireEvent.keyDown(screen.getByPlaceholderText("Search..."), {
			keyCode: 27,
		});
		expect(onEnter).not.toHaveBeenCalled();
	});

	it("focuses input on container click and toggles expanded on focus/blur", () => {
		const { container } = render(
			<SearchWidget
				isDesktop={false}
				placeholder="Search..."
				value=""
				onChange={() => {}}
			/>,
		);
		const input = screen.getByPlaceholderText("Search...");
		const focusSpy = jest.spyOn(input, "focus");
		fireEvent.click(container.firstChild);
		expect(focusSpy).toHaveBeenCalled();
		fireEvent.focus(input);
		fireEvent.blur(input);
	});

	it("removes expanded class on blur for mobile", () => {
		const { container } = render(
			<SearchWidget
				isDesktop={false}
				placeholder="Search..."
				value=""
				onChange={() => {}}
			/>,
		);
		const input = screen.getByPlaceholderText("Search...");
		fireEvent.focus(input);
		fireEvent.blur(input);
		expect(container.firstChild.className).not.toMatch(/searchExpanded/);
	});
});

describe("useSearch", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useDeviceType.mockReturnValue("desktop");
		useTranslations.mockReturnValue({
			SEARCH: "Search",
			PREVIOUS_MATCH: "Prev",
			NEXT_MATCH: "Next",
		});
		SearchStore.update((s) => {
			s.search = {};
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("debounces store updates and callback", () => {
		const updateCallback = jest.fn();
		const { result } = renderHook(() => useSearch("schedule", updateCallback));

		const toolbarCall = useToolbar.mock.calls.at(-1)[0];
		const element = toolbarCall.items[0].element;
		const { getByPlaceholderText } = render(element);
		fireEvent.change(getByPlaceholderText("Search…"), {
			target: { value: "hello" },
		});

		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(updateCallback).toHaveBeenCalledWith("hello");
		expect(result.current).toBe("hello");
	});

	it("accepts function-as-first-arg overload", () => {
		const updateCallback = jest.fn();
		renderHook(() => useSearch(updateCallback));
		expect(useToolbar).toHaveBeenCalled();
		const items = useToolbar.mock.calls.at(-1)[0].items;
		expect(items[0].id).toBe("search");
	});

	it("includes match navigation items when matchesCount > 0", () => {
		const prevMatch = jest.fn();
		const nextMatch = jest.fn();
		useDeviceType.mockReturnValue("phone");
		renderHook(() =>
			useSearch("x", jest.fn(), true, {
				matchesCount: 3,
				prevMatch,
				nextMatch,
				matchElement: <span>1/3</span>,
				onEnter: jest.fn(),
				prevName: "Up",
				nextName: "Down",
			}),
		);
		const items = useToolbar.mock.calls.at(-1)[0].items;
		expect(items.map((i) => i.id)).toEqual([
			"search",
			"prevMatch",
			"matchElement",
			"nextMatch",
		]);
		expect(items[0].location).toBe("header");
		items[1].onClick();
		items[3].onClick();
		expect(prevMatch).toHaveBeenCalled();
		expect(nextMatch).toHaveBeenCalled();
	});

	it("omits match items when matchesCount is 0", () => {
		renderHook(() =>
			useSearch("x", null, false, {
				matchesCount: 0,
				prevMatch: jest.fn(),
				nextMatch: jest.fn(),
			}),
		);
		const items = useToolbar.mock.calls.at(-1)[0].items;
		expect(items).toHaveLength(1);
		expect(useToolbar.mock.calls.at(-1)[0].visible).toBe(false);
	});

	it("defaults the search name and omits partial match toolbar items", () => {
		renderHook(() =>
			useSearch("", jest.fn(), true, {
				matchesCount: 2,
				nextMatch: jest.fn(),
			}),
		);
		const items = useToolbar.mock.calls.at(-1)[0].items;
		expect(items.map((item) => item.id)).toEqual(["search", "nextMatch"]);
	});
});
