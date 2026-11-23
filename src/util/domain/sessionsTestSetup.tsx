import { render } from "@testing-library/react";

const GROUP_METADATA = [{ name: "american", color: "#fff" }];

export function createSessionsTestHarness(
	useSessions: any,
	SessionsStore: any,
	useGroups: any,
	compactLegacySessionThumbnails: any,
	storage: any,
) {
	let latestValue: any;

	function Harness({ depends = [], options = {} }: any) {
		latestValue = useSessions(depends, options);
		return null;
	}

	function renderHarness(props: any = {}) {
		return render(<Harness {...props} />);
	}

	function getSessionsState() {
		return latestValue;
	}

	function resetSessionsTestState() {
		jest.clearAllMocks();
		latestValue = null;
		SessionsStore.update((s: any) => {
			s.sessions = null;
			s.groups = [];
			s.groupFilter = [];
			s.typeFilter = [];
			s.yearFilter = [];
			s.busy = false;
			s.counter = 0;
			s.syncCounter = 0;
			s.groupsHash = "";
			s.showFilterDialog = false;
			s.filterBarManuallyEnabled = false;
		});
		asMock(useGroups).mockReturnValue([GROUP_METADATA, false, jest.fn()]);
		asMock(compactLegacySessionThumbnails).mockResolvedValue(undefined);
		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockResolvedValue("");
		asMock(storage.getListing).mockResolvedValue([]);
		asMock(storage.getRecursiveList).mockResolvedValue([]);
	}

	return {
		GROUP_METADATA,
		getSessionsState,
		renderHarness,
		resetSessionsTestState,
	};
}
