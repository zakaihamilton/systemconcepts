import { SyncContext } from "@components/Sync";
import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import StatusBar from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({ setPath: jest.fn() }));

describe("StatusBar Widget", () => {
	const mockStore = {
		useState: jest.fn(),
		update: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			CLOSE: "Close",
			SELECT_ALL: "Select All",
			SELECT_NONE: "Select None",
			MOVE: "Move",
			DELETE: "Delete",
		});
	});

	it("renders nothing when not active", () => {
		mockStore.useState.mockReturnValue({ select: null, message: null });
		const { container } = render(
			<SyncContext.Provider value={{}}>
				<StatusBar store={mockStore} />
			</SyncContext.Provider>,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders message when provided", () => {
		mockStore.useState.mockReturnValue({
			select: null,
			message: "Status Message",
		});
		const { getByText } = render(
			<SyncContext.Provider value={{}}>
				<StatusBar store={mockStore} />
			</SyncContext.Provider>,
		);
		expect(getByText("Status Message")).toBeInTheDocument();
	});

	it("calls update when closing", () => {
		mockStore.useState.mockReturnValue({
			select: [],
			message: "Status Message",
		});
		const { getByLabelText } = render(
			<SyncContext.Provider value={{}}>
				<StatusBar store={mockStore} />
			</SyncContext.Provider>,
		);
		fireEvent.click(getByLabelText("Close"));
		expect(mockStore.update).toHaveBeenCalled();
	});
});
