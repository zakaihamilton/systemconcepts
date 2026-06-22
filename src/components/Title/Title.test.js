import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { SessionsStore } from "@util/domain/sessions";
import { useActivePages } from "@util/domain/views";
import { LibraryStore } from "@views/Library/Store";
import { ScheduleStore } from "@views/Schedule/Schedule";
import Title from "./index.js";

jest.mock("@util/domain/views");
jest.mock("@util/browser/styles");
jest.mock("@views/Schedule/Schedule", () => ({
	ScheduleStore: { useState: jest.fn() },
}));
jest.mock("@util/domain/sessions", () => ({
	SessionsStore: { useState: jest.fn() },
}));
jest.mock("@views/Library/Store", () => ({
	LibraryStore: { useState: jest.fn() },
}));
jest.mock("@components/Breadcrumbs", () => (props) => (
	<div data-testid="breadcrumbs" data-props={JSON.stringify(props)} />
));

describe("Title Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		ScheduleStore.useState.mockReturnValue({ viewMode: "list" });
		SessionsStore.useState.mockReturnValue({ viewMode: "grid" });
		LibraryStore.useState.mockReturnValue({ tags: [] });
		useActivePages.mockReturnValue([{ id: "home", name: "Home" }]);
		useDeviceType.mockReturnValue("desktop");
	});

	it("renders breadcrumbs with pages", () => {
		const { getByTestId } = render(<Title />);
		const breadcrumbs = getByTestId("breadcrumbs");
		expect(breadcrumbs).toBeInTheDocument();
		const props = JSON.parse(breadcrumbs.getAttribute("data-props"));
		expect(props.items).toEqual([{ id: "home", name: "Home" }]);
		expect(props.hideRoot).toBe(false);
	});

	it("hides root on mobile", () => {
		useDeviceType.mockReturnValue("phone");
		const { getByTestId } = render(<Title />);
		const breadcrumbs = getByTestId("breadcrumbs");
		const props = JSON.parse(breadcrumbs.getAttribute("data-props"));
		expect(props.hideRoot).toBe(true);
	});
});
