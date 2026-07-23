import { SyncContext } from "@components/Sync";
import { resetLocalCacheForFullSync } from "@sync/sync";
import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { setPath } from "@util/domain/views";
import React from "react";
import FullSync from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@sync/sync");
jest.mock("@util/domain/views");
jest.mock("@widgets/Dialog", () => ({ title, children, actions }) => (
	<div data-testid="dialog">
		<h1>{title}</h1>
		{children}
		<div data-testid="actions">{actions}</div>
	</div>
));

describe("FullSync Component", () => {
	const mockUpdateSync = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			FULL_SYNC: "Full Sync",
			CANCEL: "Cancel",
			FULL_SYNC_MESSAGE: "Do full sync?",
		});
	});

	it("renders dialog with full sync message", () => {
		const { getByText } = render(
			<SyncContext.Provider value={{ updateSync: mockUpdateSync }}>
				<FullSync />
			</SyncContext.Provider>,
		);
		expect(getByText("Do full sync?")).toBeInTheDocument();
	});

	it("starts on a fresh database and then syncs when full sync is clicked", async () => {
		resetLocalCacheForFullSync.mockResolvedValue(undefined);
		const { getByRole } = render(
			<SyncContext.Provider value={{ updateSync: mockUpdateSync }}>
				<FullSync />
			</SyncContext.Provider>,
		);
		fireEvent.click(getByRole("button", { name: "Full Sync" }));
		expect(resetLocalCacheForFullSync).toHaveBeenCalled();
		await React.act(async () => {});
		expect(mockUpdateSync).toHaveBeenCalledWith(false);
		expect(setPath).toHaveBeenCalledWith("sync");
	});
});
