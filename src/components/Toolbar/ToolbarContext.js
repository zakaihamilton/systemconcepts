import { createContext, useContext } from "react";

export const ToolbarTooltipContext = createContext(null);

export function useToolbarTooltipPlacement() {
	return useContext(ToolbarTooltipContext);
}
