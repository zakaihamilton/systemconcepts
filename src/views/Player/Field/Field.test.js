import { render } from "@testing-library/react";
import Field from "./index.js";

describe("Field Component", () => {
	it("renders name and value", () => {
		const { getByText } = render(<Field name="Label" value="Data" />);
		expect(getByText("Label:")).toBeInTheDocument();
		expect(getByText("Data")).toBeInTheDocument();
	});
});
