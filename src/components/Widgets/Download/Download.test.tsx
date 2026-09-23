import { useToolbar } from "@components/Toolbar";
import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import Download from "./index";

jest.mock("@util/domain/translations");
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));

describe("Download Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		asMock(useTranslations).mockReturnValue({ DOWNLOAD: "Download" });
	});

	it("calls useToolbar with download item when visible", () => {
		render(<Download visible={true} />);
		expect(useToolbar).toHaveBeenCalled();
		const callArgs = asMock(useToolbar).mock.calls[0][0];
		expect(callArgs.items[0].id).toBe("download");
	});

	it("calls useToolbar with empty items when not visible", () => {
		render(<Download visible={false} />);
		expect(useToolbar).toHaveBeenCalled();
		const callArgs = asMock(useToolbar).mock.calls[0][0];
		expect(callArgs.items).toHaveLength(0);
	});
});
