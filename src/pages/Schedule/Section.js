import { ScheduleStore } from "@pages/Schedule";

export function getScheduleSection({ translations }) {
    const { viewMode } = ScheduleStore.getRawState();
    let description = "";
    if (viewMode === "year") {
        description = translations.YEAR_VIEW;
    }
    else if (viewMode === "month") {
        description = translations.MONTH_VIEW;
    }
    else if (viewMode === "week") {
        description = translations.WEEK_VIEW;
    }
    else if (viewMode === "day") {
        description = translations.DAY_VIEW;
    }
    return { description };
}
