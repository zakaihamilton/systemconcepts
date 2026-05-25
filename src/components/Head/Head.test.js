import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { useCurrentPageTitle } from "@util/domain/views";
import HeadComponent from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/views");

describe("HeadComponent", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("updates document title with app name and page title", () => {
		useTranslations.mockReturnValue({ APP_NAME: "System Concepts" });
		useCurrentPageTitle.mockReturnValue("Home");

		render(<HeadComponent />);

		expect(document.title).toBe("System Concepts - Home");
	});

	it("updates document title with only app name if page title is missing", () => {
		useTranslations.mockReturnValue({ APP_NAME: "System Concepts" });
		useCurrentPageTitle.mockReturnValue("");

		render(<HeadComponent />);

		expect(document.title).toBe("System Concepts");
	});
});
