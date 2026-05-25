import { render } from "@testing-library/react";
import ItemMenuWidget from "./ItemMenu.js";

jest.mock("@components/Widgets/Select", () => () => <div data-testid="mock-select" />);
jest.mock("@widgets/Menu", () => ({ children }) => <div data-testid="mock-menu">{children}</div>);
jest.mock("@util/domain/translations", () => ({
	useTranslations: () => ({ MENU: "Menu Option" })
}));

describe("ItemMenu Component", () => {
	it("renders select widget if select is active", () => {
		const mockStore = {
			useState: jest.fn((fn) => fn({ select: { some: "config" } }))
		};

		const { getByTestId, queryByTestId } = render(
			<ItemMenuWidget item={{ id: 1 }} menuItems={[]} store={mockStore} />
		);

		expect(getByTestId("mock-select")).toBeInTheDocument();
		expect(queryByTestId("mock-menu")).not.toBeInTheDocument();
	});

	it("renders menu with tooltip if select is inactive", () => {
		const mockStore = {
			useState: jest.fn((fn) => fn({ select: null }))
		};

		const { getByTestId, queryByTestId, getByLabelText } = render(
			<ItemMenuWidget item={{ id: 1 }} menuItems={[]} store={mockStore} />
		);

		expect(getByTestId("mock-menu")).toBeInTheDocument();
		expect(queryByTestId("mock-select")).not.toBeInTheDocument();
		expect(getByLabelText("Menu Option")).toBeInTheDocument();
	});
});
