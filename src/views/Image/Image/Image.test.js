import { ContentSize } from "@components/Page/Content";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { readBinary } from "@util/binary";
import { useFetchJSON } from "@util/fetch";
import { useTranslations } from "@util/translations";
import { useParentParams, useParentPath } from "@util/views";
import ImagePage from "./index.js";

jest.mock("@util/translations");
jest.mock("@util/views");
jest.mock("@util/binary");
jest.mock("@sync/sync", () => ({
	useSync: jest.fn().mockReturnValue([0]),
}));
jest.mock("@util/fetch");
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("@widgets/Download", () => () => <div data-testid="download" />);
jest.mock("@widgets/Message", () => () => <div data-testid="message" />);

describe("Image View", () => {
	const mockSize = { width: 800, height: 600 };

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ CANNOT_LOAD_IMAGE: "Cannot load image" });
		useParentPath.mockReturnValue("local/test");
		useParentParams.mockReturnValue({});
		useFetchJSON.mockReturnValue([null, false, false]);
		readBinary.mockResolvedValue(new Blob(["test"], { type: "image/png" }));
	});

	it("renders progress while loading", async () => {
		const { getByTestId, queryByTestId, getByRole } = render(
			<ContentSize.Provider value={mockSize}>
				<ImagePage name="test" />
			</ContentSize.Provider>,
		);
		expect(getByTestId("progress")).toBeInTheDocument();
		const img = await waitFor(() => getByRole("img", { hidden: true }));
		fireEvent.load(img);
		await waitFor(() => expect(queryByTestId("progress")).not.toBeInTheDocument());
	});

	it("renders image after loading", async () => {
		const { getByRole } = render(
			<ContentSize.Provider value={mockSize}>
				<ImagePage name="test" />
			</ContentSize.Provider>,
		);
		const img = await waitFor(() => getByRole("img", { hidden: true }));
		fireEvent.load(img);
		expect(img).toBeInTheDocument();
	});
});
