import { fireEvent, render, screen } from "@testing-library/react";
import SyncLogPanel from "./SyncLogPanel";

jest.mock("@util/domain/translations", () => ({ useTranslations: () => ({}) }));

describe("SyncLogPanel", () => {
	const props = {
		syncing: true,
		syncLogs: [{ message: "First entry", type: "verbose" }],
		copyStatus: "idle" as const,
		logNotice: "Only the latest 300 entries are retained.",
		onCopy: jest.fn(),
	};

	it("keeps the reader's position when new logs arrive, and follows again at the bottom", () => {
		const { rerender } = render(<SyncLogPanel {...props} />);
		const log = screen.getByText("First entry").parentElement as HTMLDivElement;
		Object.defineProperties(log, {
			scrollHeight: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
		});
		log.scrollTop = 100;
		fireEvent.scroll(log);
		rerender(
			<SyncLogPanel
				{...props}
				syncLogs={[...props.syncLogs, { message: "Second", type: "info" }]}
			/>,
		);
		expect(log.scrollTop).toBe(100);
		log.scrollTop = 400;
		fireEvent.scroll(log);
		rerender(
			<SyncLogPanel
				{...props}
				syncLogs={[...props.syncLogs, { message: "Third", type: "info" }]}
			/>,
		);
		expect(log.scrollTop).toBe(500);
	});

	it("presents the retention notice and announces copy outcomes", () => {
		const { rerender } = render(<SyncLogPanel {...props} />);
		expect(screen.getByText(props.logNotice)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Copy log" }));
		expect(props.onCopy).toHaveBeenCalled();
		rerender(<SyncLogPanel {...props} copyStatus="copied" />);
		expect(screen.getByRole("status")).toHaveTextContent("Log copied");
		rerender(<SyncLogPanel {...props} copyStatus="error" />);
		expect(screen.getByRole("status")).toHaveTextContent("Could not copy log");
	});
});
