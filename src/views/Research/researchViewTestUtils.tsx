import { ContentSize } from "@components/Page/Content";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";

export function renderResearchView(
	Component: ComponentType,
	size: { width: number; height: number; emPixels: number },
) {
	return render(
		<ContentSize.Provider value={size}>
			<Component />
		</ContentSize.Provider>,
	);
}
