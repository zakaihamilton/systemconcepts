import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { useCurrentPageTitle } from "@util/domain/views";
import ClientHead from "./ClientHead";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views");

describe("ClientHead Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("updates document title with app name and page title", () => {
		asMock(useTranslations).mockReturnValue({ APP_NAME: "System Concepts" });
		asMock(useCurrentPageTitle).mockReturnValue("Dashboard");

		render(<ClientHead />);

		expect(document.title).toBe("System Concepts - Dashboard");
	});

	it("updates document title with only app name if page title is missing", () => {
		asMock(useTranslations).mockReturnValue({ APP_NAME: "System Concepts" });
		asMock(useCurrentPageTitle).mockReturnValue("");

		render(<ClientHead />);

		expect(document.title).toBe("System Concepts");
	});
});
