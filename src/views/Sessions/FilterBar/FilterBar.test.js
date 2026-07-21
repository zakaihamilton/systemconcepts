import { fireEvent, render, screen } from "@testing-library/react";
import { SessionsStore } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import FilterBar from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
	SessionsStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), error: jest.fn() },
}));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<span title={title}>{children}</span>
));
jest.mock("@widgets/Menu", () => {
	function MenuItem({ item }) {
		return (
			<div data-testid={`menu-item-${item.id}`}>
				<button type="button" onClick={(e) => item.onClick?.(e)}>
					{item.name}
				</button>
				{item.checked ? <span data-testid={`checked-${item.id}`} /> : null}
				{item.radio ? <span data-testid={`radio-${item.id}`} /> : null}
				{item.highlight ? <span data-testid={`highlight-${item.id}`} /> : null}
				{(item.items || []).map((child) => (
					<MenuItem key={child.id} item={child} />
				))}
			</div>
		);
	}
	return function MockMenu({ items, children }) {
		return (
			<div data-testid="menu">
				{children}
				{(items || []).map((item) => (
					<MenuItem key={item.id} item={item} />
				))}
			</div>
		);
	};
});

const translations = {
	TYPES: "Types",
	AUDIO: "Audio",
	VIDEO: "Video",
	IMAGE: "Image",
	OVERVIEW: "Overview",
	AI: "AI",
	EXCLUDE: "Exclude",
	EXCLUDE_IMAGE_ONLY: "Exclude image only",
	THUMBNAIL: "Thumbnail",
	ALL: "All",
	WITH_THUMBNAIL: "With thumbnail",
	WITHOUT_THUMBNAIL: "Without thumbnail",
	SUMMARY: "Summary",
	WITH_SUMMARY: "With summary",
	WITHOUT_SUMMARY: "Without summary",
	TAGS: "Tags",
	WITH_TAGS: "With tags",
	WITHOUT_TAGS: "Without tags",
	DURATION: "Duration",
	WITH_DURATION: "With duration",
	WITHOUT_DURATION: "Without duration",
	POSITION: "Position",
	WITH_POSITION: "With position",
	WITHOUT_POSITION: "Without position",
	LANGUAGE: "Language",
	BOTH: "Both",
	ENGLISH: "English",
	HEBREW: "Hebrew",
	ATTRIBUTES: "Attributes",
	ATTRIBUTE: "Attribute",
	SELECTED: "selected",
	YEARS: "Years",
	YEAR: "Year",
	GROUPS: "Groups",
	GROUP: "Group",
	CLEAR_FILTER: "Clear filter",
};

function makeState(overrides = {}) {
	return {
		typeFilter: [],
		yearFilter: [],
		groupFilter: [],
		sessions: [
			{ year: "2024", name: "a" },
			{ year: "2023", name: "b" },
			{ year: "2024", name: "c" },
			{ name: "no-year" },
		],
		groups: [
			{ name: "alpha", color: "#111" },
			{ name: "beta", color: "#222" },
		],
		showFilterDialog: true,
		...overrides,
	};
}

describe("FilterBar", () => {
	let state;

	beforeEach(() => {
		jest.clearAllMocks();
		state = makeState();
		useTranslations.mockReturnValue(translations);
		SessionsStore.useState = jest.fn((selector) => selector(state));
		SessionsStore.update = jest.fn((updater) => updater(state));
	});

	it("renders attribute/year/group labels when filters are empty", () => {
		render(<FilterBar />);
		expect(screen.getByText("Attributes")).toBeInTheDocument();
		expect(screen.getByText("Years")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
	});

	it("hides year filter when hideYears is true", () => {
		render(<FilterBar hideYears />);
		expect(screen.queryByText("Years")).not.toBeInTheDocument();
		expect(screen.getByText("Attributes")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
	});

	it("applies hide class when filter dialog is closed", () => {
		state = makeState({ showFilterDialog: false });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		const { container } = render(<FilterBar />);
		expect(container.firstChild.className).toMatch(/hide/);
	});

	it("shows single-selection labels for type, year, and group", () => {
		state = makeState({
			typeFilter: ["audio"],
			yearFilter: ["2024"],
			groupFilter: ["alpha"],
		});
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(screen.getAllByText("Audio").length).toBeGreaterThan(0);
		expect(screen.getByText("Attribute")).toBeInTheDocument();
		expect(screen.getAllByText("2024").length).toBeGreaterThan(0);
		expect(screen.getByText("Year")).toBeInTheDocument();
		expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
		expect(screen.getByText("Group")).toBeInTheDocument();
	});

	it("shows multi-selection labels", () => {
		state = makeState({
			typeFilter: ["audio", "video"],
			yearFilter: ["2024", "2023"],
			groupFilter: ["alpha", "beta"],
		});
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(screen.getAllByText("2 selected")).toHaveLength(3);
		expect(screen.getByText("Attributes")).toBeInTheDocument();
		expect(screen.getByText("Years")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
	});

	it("toggles checkbox type filters on and off", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "Audio" }));
		expect(state.typeFilter).toEqual(["audio"]);

		fireEvent.click(screen.getByRole("button", { name: "Audio" }));
		expect(state.typeFilter).toEqual([]);
	});

	it("selects radio filters and clears sibling radios", () => {
		state = makeState({ typeFilter: ["without_thumbnail"] });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);

		fireEvent.click(screen.getByRole("button", { name: "With thumbnail" }));
		expect(state.typeFilter).toContain("with_thumbnail");
		expect(state.typeFilter).not.toContain("without_thumbnail");
	});

	it.each([
		["thumbnails_all", "All", ["with_thumbnail", "without_thumbnail"]],
		["summaries_all", "All", ["with_summary", "without_summary"]],
		["tags_all", "All", ["with_tags", "without_tags"]],
		["duration_all", "All", ["with_duration", "without_duration"]],
		["position_all", "All", ["with_position", "without_position"]],
		["languages_all", "Both", ["with_english", "with_hebrew"]],
	])("clears related filters when selecting %s", (id, label, related) => {
		state = makeState({ typeFilter: [...related, "audio"] });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);

		const buttons = screen.getAllByRole("button", { name: label });
		const target = buttons.find((btn) => {
			const item = btn.closest(`[data-testid="menu-item-${id}"]`);
			return !!item;
		});
		fireEvent.click(target);
		related.forEach((value) => {
			expect(state.typeFilter).not.toContain(value);
		});
		expect(state.typeFilter).toContain("audio");
	});

	it("marks default radio options when no radio filter is active", () => {
		render(<FilterBar />);
		expect(screen.getByTestId("radio-thumbnails_all")).toBeInTheDocument();
		expect(screen.getByTestId("radio-summaries_all")).toBeInTheDocument();
		expect(screen.getByTestId("radio-tags_all")).toBeInTheDocument();
		expect(screen.getByTestId("radio-duration_all")).toBeInTheDocument();
		expect(screen.getByTestId("radio-position_all")).toBeInTheDocument();
		expect(screen.getByTestId("radio-languages_all")).toBeInTheDocument();
	});

	it("highlights headers when child filters are active", () => {
		state = makeState({
			typeFilter: [
				"audio",
				"exclude_image_only",
				"with_thumbnail",
				"with_summary",
				"with_tags",
				"with_duration",
				"with_position",
				"with_english",
			],
		});
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(screen.getByTestId("highlight-category_header")).toBeInTheDocument();
		expect(screen.getByTestId("highlight-image_header")).toBeInTheDocument();
		expect(
			screen.getByTestId("highlight-thumbnail_header"),
		).toBeInTheDocument();
		expect(screen.getByTestId("highlight-summary_header")).toBeInTheDocument();
		expect(screen.getByTestId("highlight-tags_header")).toBeInTheDocument();
		expect(screen.getByTestId("highlight-duration_header")).toBeInTheDocument();
		expect(screen.getByTestId("highlight-position_header")).toBeInTheDocument();
		expect(screen.getByTestId("highlight-language_header")).toBeInTheDocument();
	});

	it("does not change typeFilter when clicking a header item", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "Types" }));
		expect(state.typeFilter).toEqual([]);
	});

	it("toggles year filters and builds unique sorted years", () => {
		render(<FilterBar />);
		const yearButtons = screen.getAllByRole("button", { name: "2024" });
		fireEvent.click(yearButtons[0]);
		expect(state.yearFilter).toEqual(["2024"]);
		fireEvent.click(yearButtons[0]);
		expect(state.yearFilter).toEqual([]);
	});

	it("handles empty sessions and groups safely", () => {
		state = makeState({ sessions: null, groups: null });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(screen.getByText("Years")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
	});

	it("toggles group filters", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
		expect(state.groupFilter).toEqual(["alpha"]);
		fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
		expect(state.groupFilter).toEqual([]);
	});

	it("clears type, year, and group filters via clear icons", () => {
		state = makeState({
			typeFilter: ["audio"],
			yearFilter: ["2024"],
			groupFilter: ["alpha"],
		});
		SessionsStore.useState = jest.fn((selector) => selector(state));
		const { container } = render(<FilterBar />);
		const clearIcons = container.querySelectorAll('[title="Clear filter"] svg');
		expect(clearIcons.length).toBeGreaterThanOrEqual(3);

		fireEvent.click(clearIcons[0]);
		expect(state.typeFilter).toEqual([]);
		fireEvent.click(clearIcons[1]);
		expect(state.yearFilter).toEqual([]);
		fireEvent.click(clearIcons[2]);
		expect(state.groupFilter).toEqual([]);
	});

	it("toggles checkbox type filters including overview and image", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "Overview" }));
		expect(state.typeFilter).toEqual(["overview"]);
		fireEvent.click(screen.getByRole("button", { name: "Image" }));
		expect(state.typeFilter).toEqual(["overview", "image"]);
		fireEvent.click(screen.getByRole("button", { name: "Exclude image only" }));
		expect(state.typeFilter).toContain("exclude_image_only");
	});

	it("selects language and duration radio options", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "English" }));
		expect(state.typeFilter).toContain("with_english");
		fireEvent.click(screen.getByRole("button", { name: "Hebrew" }));
		expect(state.typeFilter).toContain("with_hebrew");
		expect(state.typeFilter).not.toContain("with_english");

		fireEvent.click(screen.getByRole("button", { name: "With duration" }));
		expect(state.typeFilter).toContain("with_duration");
		fireEvent.click(screen.getByRole("button", { name: "Without duration" }));
		expect(state.typeFilter).toContain("without_duration");
		expect(state.typeFilter).not.toContain("with_duration");
	});

	it("selects summary, tags, and position radios", () => {
		render(<FilterBar />);
		fireEvent.click(screen.getByRole("button", { name: "With summary" }));
		fireEvent.click(screen.getByRole("button", { name: "With tags" }));
		fireEvent.click(screen.getByRole("button", { name: "With position" }));
		expect(state.typeFilter).toEqual(
			expect.arrayContaining(["with_summary", "with_tags", "with_position"]),
		);
	});

	it("shows checked markers for active checkbox filters", () => {
		state = makeState({ typeFilter: ["exclude_image_only", "ai"] });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(
			screen.getByTestId("checked-exclude_image_only"),
		).toBeInTheDocument();
		expect(screen.getByTestId("checked-ai")).toBeInTheDocument();
	});

	it("resolves unknown single type filter label gracefully", () => {
		state = makeState({ typeFilter: ["unknown_type"] });
		SessionsStore.useState = jest.fn((selector) => selector(state));
		render(<FilterBar />);
		expect(screen.getByText("Attribute")).toBeInTheDocument();
	});
});
