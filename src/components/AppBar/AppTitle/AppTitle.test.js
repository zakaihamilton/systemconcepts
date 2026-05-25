import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import AppTitle from "./AppTitle.js";

jest.mock("@util/domain/translations");

describe("AppTitle Component", () => {
	it("renders APP_NAME in typography component", () => {
		useTranslations.mockReturnValue({ APP_NAME: "My Awesome App" });

		const { getByText } = render(<AppTitle />);

		expect(getByText("My Awesome App")).toBeInTheDocument();
	});
});
