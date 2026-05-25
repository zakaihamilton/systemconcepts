import { useToolbar } from "@components/Toolbar";
import { render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import Download from "./index.js";

jest.mock("@util/translations");
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));

describe("Download Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ DOWNLOAD: "Download" });
	});

	it("calls useToolbar with download item when visible", () => {
		render(<Download visible={true} />);
		expect(useToolbar).toHaveBeenCalled();
		const callArgs = useToolbar.mock.calls[0][0];
		expect(callArgs.items[0].id).toBe("download");
	});

	it("calls useToolbar with empty items when not visible", () => {
		render(<Download visible={false} />);
		expect(useToolbar).toHaveBeenCalled();
		const callArgs = useToolbar.mock.calls[0][0];
		expect(callArgs.items).toHaveLength(0);
	});
});
