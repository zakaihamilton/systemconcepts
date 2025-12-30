import DateRangeIcon from "@mui/icons-material/DateRange";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import { ScheduleStore } from "@pages/Schedule";

export function getScheduleSection({ translations }) {
    const { viewMode } = ScheduleStore.getRawState();
    let description = "";
    let Icon = null;
    if (viewMode === "year") {
        description = translations.YEAR_VIEW;
        Icon = CalendarViewMonthIcon;
    }
    else if (viewMode === "month") {
        description = translations.MONTH_VIEW;
        Icon = DateRangeIcon;
    }
    else if (viewMode === "week") {
        description = translations.WEEK_VIEW;
        Icon = ViewWeekIcon;
    }
    else if (viewMode === "day") {
        description = translations.DAY_VIEW;
        Icon = CalendarViewDayIcon;
    }
    else if (viewMode === "swimlanes") {
        description = translations.SWIMLANES_VIEW;
        Icon = ViewStreamIcon;
    }
    const menuItems = [
        {
            name: translations.YEAR_VIEW,
            icon: <CalendarViewMonthIcon />,
            onClick: () => {
                ScheduleStore.update(s => { s.viewMode = "year"; });
            }
        },
        {
            name: translations.MONTH_VIEW,
            icon: <DateRangeIcon />,
            onClick: () => {
                ScheduleStore.update(s => { s.viewMode = "month"; });
            }
        },
        {
            name: translations.WEEK_VIEW,
            icon: <ViewWeekIcon />,
            onClick: () => {
                ScheduleStore.update(s => { s.viewMode = "week"; });
            }
        },
        {
            name: translations.DAY_VIEW,
            icon: <CalendarViewDayIcon />,
            onClick: () => {
                ScheduleStore.update(s => { s.viewMode = "day"; });
            }
        },
        {
            name: translations.SWIMLANES_VIEW,
            icon: <ViewStreamIcon />,
            onClick: () => {
                ScheduleStore.update(s => { s.viewMode = "swimlanes"; });
            }
        }
    ];
    return { description, menuItems, ...Icon && { Icon } };
}
