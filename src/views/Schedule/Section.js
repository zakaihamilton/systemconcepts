import CalendarViewDayIcon from "@icons/svg/CalendarViewDay.svg";
import CalendarViewMonthIcon from "@icons/svg/CalendarViewMonth.svg";
import DateRangeIcon from "@icons/svg/DateRange.svg";
import RestoreIcon from "@icons/svg/Restore.svg";
import ViewStreamIcon from "@icons/svg/ViewStream.svg";
import ViewWeekIcon from "@icons/svg/ViewWeek.svg";
import { ScheduleStore } from "@views/Schedule/Schedule";
export function getScheduleSection({ translations }) {
	const { viewMode } = ScheduleStore.getRawState();
	let description = "";
	let Icon = null;
	if (viewMode === "year") {
		description = translations.YEAR_VIEW;
		Icon = CalendarViewMonthIcon;
	} else if (viewMode === "month") {
		description = translations.MONTH_VIEW;
		Icon = DateRangeIcon;
	} else if (viewMode === "week") {
		description = translations.WEEK_VIEW;
		Icon = ViewWeekIcon;
	} else if (viewMode === "day") {
		description = translations.DAY_VIEW;
		Icon = CalendarViewDayIcon;
	} else if (viewMode === "tracks") {
		description = translations.TRACKS_VIEW;
		Icon = ViewStreamIcon;
	} else if (viewMode === "history") {
		description = translations.HISTORY_VIEW;
		Icon = RestoreIcon;
	}
	const menuItems = [
		{
			name: translations.YEAR_VIEW,
			icon: <CalendarViewMonthIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "year";
				});
			},
		},
		{
			name: translations.MONTH_VIEW,
			icon: <DateRangeIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "month";
				});
			},
		},
		{
			name: translations.WEEK_VIEW,
			icon: <ViewWeekIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "week";
				});
			},
		},
		{
			name: translations.DAY_VIEW,
			icon: <CalendarViewDayIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "day";
				});
			},
		},
		{
			name: translations.TRACKS_VIEW,
			icon: <ViewStreamIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "tracks";
				});
			},
		},
		{
			name: translations.HISTORY_VIEW,
			icon: <RestoreIcon />,
			onClick: () => {
				ScheduleStore.update((s) => {
					s.viewMode = "history";
				});
			},
		},
	];
	return { description, menuItems, ...(Icon && { Icon }) };
}
