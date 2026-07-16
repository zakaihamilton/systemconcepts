import { render } from "@testing-library/react";
import Video from "./index.js";

jest.mock("../Controls", () => () => <div data-testid="controls" />);
jest.mock("../Toolbar", () => () => <div data-testid="toolbar" />);
jest.mock("../Player", () => ({
	PlayerStore: {
		update: jest.fn(),
	},
}));

describe("Video Component", () => {
	it("renders video element and sub-components", () => {
		const { getByTestId } = render(
			<Video show={true} name="Test Video" group="testgroup" color="blue" />,
		);
		expect(getByTestId("controls")).toBeInTheDocument();
		expect(getByTestId("toolbar")).toBeInTheDocument();
	});

	it("loads the media when its source path becomes available", () => {
		const load = jest
			.spyOn(HTMLMediaElement.prototype, "load")
			.mockImplementation(() => {});

		render(
			<Video
				show={true}
				name="Test Video"
				group="testgroup"
				color="blue"
				path="https://media.example/test.mp4"
			/>,
		);

		expect(load).toHaveBeenCalledTimes(1);
		load.mockRestore();
	});
});
