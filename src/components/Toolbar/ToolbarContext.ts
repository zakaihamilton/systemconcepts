import { createContext, useContext } from "react";

export const ToolbarTooltipContext = createContext<string | null>(null);

export function useToolbarTooltipPlacement() {
	return useContext(ToolbarTooltipContext);
}
