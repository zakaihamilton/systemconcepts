import { SyncContext } from "@components/Sync";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { setPath } from "@util/domain/views";
import StatusBar from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views", () => ({ setPath: jest.fn() }));
jest.mock("@components/Widgets/ButtonSelector", () => (props) => (
	<button
		type="button"
		data-testid="button-selector"
		disabled={props.disabled}
		onClick={props.onClick}
	>
		{props.children}
		{props.items?.map((i) => (
			<span
				key={i.id}
				data-testid={`mode-${i.id}`}
				onClick={() => props.state[1](i.id)}
			>
				{i.name}
			</span>
		))}
	</button>
));

describe("StatusBar Widget", () => {
	const mockStore = {
		useState: jest.fn(),
		update: jest.fn((updater) => {
			const state = mockStore.useState();
			updater(state);
		}),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useTranslations.mockReturnValue({
			CLOSE: "Close",
			SELECT_ALL: "Select All",
			SELECT_NONE: "Select None",
			MOVE: "Move",
			COPY: "Copy",
			DELETE: "Delete",
			ACCOUNT: "Account",
			WAIT_FOR_APPROVAL: "Wait for approval",
			COPIED: "Copied!",
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const renderBar = (storeState, syncValue = {}) => {
		mockStore.useState.mockReturnValue(storeState);
		return render(
			<SyncContext.Provider value={syncValue}>
				<StatusBar
					store={mockStore}
					data={[{ id: 1 }, { id: 2 }]}
					mapper={(i) => i}
				/>
			</SyncContext.Provider>,
		);
	};

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
		renderBar({ select: null, message: "Status Message" });
		expect(screen.getByText("Status Message")).toBeInTheDocument();
	});

	it("calls update when closing", () => {
		renderBar({ select: [], message: "Status Message" });
		fireEvent.click(screen.getByLabelText("Close"));
		expect(mockStore.update).toHaveBeenCalled();
	});

	it("copies player load errors", async () => {
		const writeText = jest.fn().mockResolvedValue();
		Object.assign(navigator, { clipboard: { writeText } });
		renderBar({
			select: null,
			mode: "player",
			severity: "error",
			message: "Couldn't load the session",
		});

		fireEvent.click(screen.getByLabelText("Copy"));
		expect(writeText).toHaveBeenCalledWith("Couldn't load the session");
		act(() => {
			jest.advanceTimersByTime(2000);
		});
	});

	it("ignores clipboard errors when copying", async () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: jest.fn().mockRejectedValue(new Error("denied")),
			},
		});
		renderBar({
			select: null,
			mode: "player",
			severity: "error",
			message: "fail",
		});
		fireEvent.click(screen.getByLabelText("Copy"));
		expect(screen.getByText("fail")).toBeInTheDocument();
	});

	it("shows select-all icon and selects all items", () => {
		const state = { select: [], message: null, mode: "delete" };
		renderBar(state);
		fireEvent.click(screen.getByLabelText("Select All"));
		expect(mockStore.update).toHaveBeenCalled();
	});

	it("shows select-none when all selected", () => {
		renderBar({
			select: [{ id: 1 }, { id: 2 }],
			message: null,
			mode: "delete",
		});
		expect(screen.getByLabelText("Select None")).toBeInTheDocument();
		fireEvent.click(screen.getByLabelText("Select None"));
		expect(mockStore.update).toHaveBeenCalled();
	});

	it("shows indeterminate when partially selected", () => {
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
		});
		expect(screen.getByLabelText("Select None")).toBeInTheDocument();
	});

	it("runs delete action via onDone", async () => {
		const onDone = jest.fn().mockResolvedValue(false);
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
			onDone,
		});
		fireEvent.click(screen.getByLabelText("Delete"));
		await waitFor(() => {
			expect(onDone).toHaveBeenCalled();
		});
	});

	it("surfaces onDone errors", async () => {
		const onDone = jest.fn().mockRejectedValue(new Error("boom"));
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
			onDone,
		});
		fireEvent.click(screen.getByLabelText("Delete"));
		await waitFor(() => {
			expect(mockStore.update).toHaveBeenCalled();
		});
	});

	it("renders move/copy selector and switches mode", () => {
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "move",
		});
		expect(screen.getByTestId("button-selector")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("mode-copy"));
		expect(mockStore.update).toHaveBeenCalled();
	});

	it("shows wait-for-approval when sync mode has error", () => {
		renderBar(
			{ select: null, message: "ignored", mode: "sync" },
			{ error: true },
		);
		expect(screen.getByText("Wait for approval")).toBeInTheDocument();
	});

	it("navigates to account in signin mode", () => {
		window.location.hash = "#sessions";
		renderBar({ select: null, message: "Please sign in", mode: "signin" });
		fireEvent.click(screen.getByRole("button", { name: "Account" }));
		expect(setPath).toHaveBeenCalledWith(
			expect.stringContaining("account?redirect="),
		);
	});

	it("ignores close when clickaway is reported", () => {
		renderBar({ select: [], message: "Status Message" });
		const close = screen.getByLabelText("Close");
		mockStore.update.mockClear();
		close.onclick?.({}, "clickaway");
		expect(mockStore.update).not.toHaveBeenCalled();
	});

	it("hides the close button while delete is busy", async () => {
		const onDone = jest.fn(
			() => new Promise((resolve) => setTimeout(() => resolve(false), 50)),
		);
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
			onDone,
		});
		fireEvent.click(screen.getByLabelText("Delete"));
		expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
	});

	it("ignores close while delete is busy even without clickaway reason", async () => {
		const onDone = jest.fn(
			() => new Promise((resolve) => setTimeout(() => resolve(false), 50)),
		);
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
			onDone,
		});
		fireEvent.click(screen.getByLabelText("Delete"));
		mockStore.update.mockClear();
		const close = screen.queryByLabelText("Close");
		if (close) {
			fireEvent.click(close);
		}
		expect(mockStore.update).not.toHaveBeenCalled();
	});

	it("keeps selection mode open when onDone returns true", async () => {
		const onDone = jest.fn().mockResolvedValue(true);
		renderBar({
			select: [{ id: 1 }],
			message: null,
			mode: "delete",
			onDone,
		});
		const callsBefore = mockStore.update.mock.calls.length;
		fireEvent.click(screen.getByLabelText("Delete"));
		await waitFor(() => {
			expect(onDone).toHaveBeenCalled();
		});
		expect(mockStore.update.mock.calls.length).toBe(callsBefore);
	});
});
