import Cookies from "js-cookie";
import {
	getAutoSyncJitter,
	persistAutoSyncVersion,
	shouldRunInitialAutoSync,
} from "./autoSync";
import { SyncActiveStore } from "./syncState";

jest.mock("js-cookie", () => ({
	__esModule: true,
	default: { get: jest.fn() },
}));

describe("user-scoped automatic sync state", () => {
	beforeEach(() => {
		localStorage.clear();
		Cookies.get.mockReset();
		SyncActiveStore.update((state) => {
			state.lastSyncTime = 100;
		});
	});

	it("stores jitter independently for each signed-in user", () => {
		Cookies.get.mockReturnValue("user-1");
		const userOneJitter = getAutoSyncJitter();
		Cookies.get.mockReturnValue("user-2");
		const userTwoJitter = getAutoSyncJitter();

		expect(localStorage.getItem("sync_autoSyncJitter:user-1")).toBe(
			String(userOneJitter),
		);
		expect(localStorage.getItem("sync_autoSyncJitter:user-2")).toBe(
			String(userTwoJitter),
		);
	});

	it("does not reuse a different user's persisted app version", () => {
		process.env.NEXT_PUBLIC_VERSION = "2.3.1";
		Cookies.get.mockReturnValue("user-1");
		persistAutoSyncVersion();
		expect(shouldRunInitialAutoSync()).toBe(false);

		Cookies.get.mockReturnValue("user-2");
		expect(shouldRunInitialAutoSync()).toBe(true);
	});
});
