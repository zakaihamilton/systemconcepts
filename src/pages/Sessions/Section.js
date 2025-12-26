import { SessionsStore } from "@util/sessions";

export function getSessionsSection({ translations }) {
    const { viewMode } = SessionsStore.getRawState();
    let description = "";
    if (viewMode === "list") {
        description = translations.LIST_VIEW;
    }
    else if (viewMode === "table") {
        description = translations.TABLE_VIEW;
    }
    else if (viewMode === "grid") {
        description = translations.GRID_VIEW;
    }
    return { description };
}
