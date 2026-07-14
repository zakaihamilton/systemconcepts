import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowBackIcon from "@icons/svg/ArrowBack.svg";
import ArrowForwardIcon from "@icons/svg/ArrowForward.svg";
import ChevronLeftIcon from "@icons/svg/ChevronLeft.svg";
import ChevronRightIcon from "@icons/svg/ChevronRight.svg";
import TodayIcon from "@icons/svg/Today.svg";
import { useDeviceType } from "@util/browser/styles";
import {
	addDate,
	getMonthNames,
	getMonthViewStart,
	getNumberOfWeeksInMonth,
	getWeekOfMonth,
	getWeekViewStart,
	getYearNames,
	setWeekOfMonth,
} from "@util/data/date";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import Input from "@widgets/Input";
import clsx from "clsx";
import { useState } from "react";
import DayHeader from "./DayHeader";
import Week from "./Week";
import styles from "./WeekView.module.css";

registerToolbar("WeekView");

export default function WeekView({ sessions, date, store, playingSession }) {
	const { lastViewMode } = store.useState();
	const [collapsedGroups, setCollapsedGroups] = useState([]);
	const isPhone = useDeviceType() === "phone";
	const direction = useDirection();
	const translations = useTranslations();
	const firstDay = getWeekViewStart(date);
	// Use Thursday (day 4) of the current week to determine which month we're in
	// This follows the ISO week date standard where a week belongs to the month containing Thursday
	const month = addDate(firstDay, 4);
	const dayHeaderFormatter = useDateFormatter({
		weekday: "short",
	});
	const dayFormatter = useDateFormatter({
		day: "numeric",
	});
	const dateFormatter = useDateFormatter({
		day: "numeric",
		month: "short",
	});
	const monthFormatter = useDateFormatter({
		month: isPhone ? "short" : "long",
	});
	const yearFormatter = useDateFormatter({
		year: "numeric",
	});

	const numDaysInWeek = 7;
	const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
		const day = addDate(firstDay, index);
		return (
			<DayHeader
				key={index}
				date={day}
				index={index}
				count={numDaysInWeek}
				dateFormatter={dateFormatter}
				dayFormatter={dayHeaderFormatter}
				store={store}
			/>
		);
	});

	// Calculate week number based on the month (middle of week), not the original date
	// This ensures weeks spanning months show the correct week number for the displayed month
	const weekOfMonth = getWeekOfMonth(month);
	const numOfWeeksInMonth = getNumberOfWeeksInMonth(month);
	const weekState = [
		weekOfMonth + 1,
		(week) => {
			const newDate = new Date(month);
			setWeekOfMonth(newDate, week - 1);
			store.update((s) => {
				s.date = newDate;
			});
		},
	];
	const weekItems = new Array(numOfWeeksInMonth || 0)
		.fill(0)
		.map((_, index) => {
			return {
				id: index + 1,
				name: index + 1,
			};
		});

	const weekWidget = (
		<Input
			select={true}
			label={translations.WEEK}
			helperText=""
			fullWidth={false}
			items={weekItems}
			state={weekState}
			className={styles.weekInput}
		/>
	);

	const monthState = [
		month.getMonth() + 1,
		(newMonth) => {
			const newDate = new Date(date);
			newDate.setMonth(newMonth - 1);
			newDate.setDate(1);
			// Get the first day of the first week of this month (Sunday before or on the 1st)
			const firstWeekStart = getMonthViewStart(newDate);
			store.update((s) => {
				s.date = firstWeekStart;
			});
		},
	];
	const monthItems = getMonthNames(month, monthFormatter).map((name, index) => {
		return {
			id: index + 1,
			name,
		};
	});
	const monthWidget = (
		<Input
			select={true}
			label={translations.MONTH}
			helperText=""
			fullWidth={false}
			items={monthItems}
			state={monthState}
			className={clsx(styles.monthInput, isPhone && styles.monthInputPhone)}
		/>
	);

	const yearState = [
		month.getFullYear(),
		(year) => {
			const newDate = new Date(date);
			newDate.setFullYear(year);
			store.update((s) => {
				s.date = newDate;
			});
		},
	];
	const currentYear = month.getFullYear();
	const yearStart = 2015;
	let yearEnd = new Date().getFullYear() + 2;
	if (yearEnd < yearStart) {
		yearEnd = yearStart + 1;
	}
	if (currentYear > yearEnd) {
		yearEnd = currentYear;
	}
	const yearItems = getYearNames(month, yearFormatter, yearStart, yearEnd).map(
		(name, index) => {
			return {
				id: yearStart + index,
				name,
			};
		},
	);
	const yearWidget = (
		<Input
			select={true}
			label={translations.YEAR}
			helperText=""
			fullWidth={false}
			items={yearItems}
			state={yearState}
			className={styles.yearInput}
		/>
	);

	const gotoPreviousWeek = () => {
		const newDate = new Date(firstDay);
		setWeekOfMonth(newDate, getWeekOfMonth(newDate) - 1);
		store.update((s) => {
			s.date = newDate;
		});
	};

	const gotoNextWeek = () => {
		const newDate = new Date(firstDay);
		setWeekOfMonth(newDate, getWeekOfMonth(newDate) + 1);
		store.update((s) => {
			s.date = newDate;
		});
	};

	const today = new Date();
	const hasPreviousWeek = weekOfMonth || month.getFullYear() !== yearStart;
	const hasNextWeek =
		weekOfMonth !== numOfWeeksInMonth - 1 || month.getFullYear() !== yearEnd;
	const isToday =
		weekOfMonth === getWeekOfMonth(today) &&
		month.getMonth() == today.getMonth() &&
		month.getFullYear() == today.getFullYear();

	const gotoToday = () => {
		store.update((s) => {
			s.date = today;
		});
	};

	const goBack = () => {
		if (lastViewMode) {
			store.update((s) => {
				s.viewMode = lastViewMode;
				s.lastViewMode = null;
			});
		}
	};

	const toggleGroup = (group) => {
		setCollapsedGroups((groups) => {
			if (groups.includes(group)) {
				return groups.filter((item) => item !== group);
			}
			return [...groups, group];
		});
	};

	const toolbarItems = [
		{
			id: "back",
			name: translations.BACK,
			icon: direction === "rtl" ? <ArrowForwardIcon /> : <ArrowBackIcon />,
			onClick: goBack,
			location: "header",
			disabled: !lastViewMode,
		},
		{
			id: "today",
			name: translations.TODAY,
			icon: <TodayIcon />,
			onClick: gotoToday,
			location: "header",
			disabled: isToday,
			menu: false,
		},
		{
			id: "previousWeek",
			name: translations.PREVIOUS_WEEK,
			icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
			onClick: gotoPreviousWeek,
			disabled: !hasPreviousWeek,
			location: "footer",
		},
		{
			id: "weekWidget",
			element: weekWidget,
			location: "footer",
		},
		{
			id: "monthWidget",
			element: monthWidget,
			location: "footer",
		},
		{
			id: "yearWidget",
			element: yearWidget,
			location: "footer",
		},
		{
			id: "nextWeek",
			divider: true,
			name: translations.NEXT_WEEK,
			icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
			onClick: gotoNextWeek,
			disabled: !hasNextWeek,
			location: "footer",
		},
	].filter(Boolean);

	useToolbar({
		id: "WeekView",
		items: toolbarItems,
		depends: [translations, month, lastViewMode],
	});

	return (
		<div className={styles.root}>
			<div className={clsx(styles.grid, isPhone && styles.mobile)}>
				{dayTitles}
				<Week
					sessions={sessions}
					month={month}
					date={firstDay}
					row={2}
					dateFormatter={dayFormatter}
					playingSession={playingSession}
					collapsedGroups={collapsedGroups}
					onToggleGroup={toggleGroup}
				/>
			</div>
		</div>
	);
}
