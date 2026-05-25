import { ContentSize } from "@components/Page/Content";
import { useToolbar } from "@components/Toolbar";
import { render, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import React from "react";
import Zoom, { ZoomStore } from "./index.js";

jest.mock("@util/translations");
jest.mock("@components/Toolbar");

describe("Zoom Component", () => {
	const mockTranslations = {
		ZOOM_IN: "Zoom In",
		ZOOM_OUT: "Zoom Out",
	};

	let mockRef;

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		ZoomStore.update((s) => {
			s.scale = 1.0;
		});
		mockRef = { current: { style: {} } };
	});

	it("registers toolbar items", () => {
		render(
			<ContentSize.Provider value={{ ref: mockRef }}>
				<Zoom />
			</ContentSize.Provider>,
		);
		expect(useToolbar).toHaveBeenCalled();
		const toolbarArgs = useToolbar.mock.calls[0][0];
		expect(toolbarArgs.items).toHaveLength(2);
	});

	it("updates scale and ref style on zoom in", async () => {
		let toolbarItems = [];
		useToolbar.mockImplementation(({ items }) => {
			toolbarItems = items;
		});

		render(
			<ContentSize.Provider value={{ ref: mockRef }}>
				<Zoom />
			</ContentSize.Provider>,
		);

		const zoomInItem = toolbarItems.find((item) => item.id === "zoom_in");

		await React.act(async () => {
			zoomInItem.onClick();
		});

		expect(ZoomStore.getRawState().scale).toBeCloseTo(1.1);

		await waitFor(() => {
			expect(mockRef.current.style.transform).toBe("scale(1.1)");
		});
	});
});
