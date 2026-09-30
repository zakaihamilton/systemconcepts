import { registerToolbar, useToolbar } from "@components/Toolbar";
import ChevronLeftIcon from "@icons/svg/ChevronLeft.svg";
import ChevronRightIcon from "@icons/svg/ChevronRight.svg";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { getSessionTextColor } from "@util/data/colors";
import {
	addDate,
	getDateString,
	getMonthNames,
	getMonthViewStart,
	getNumberOfWeeksInMonth,
	getYearNames,
} from "@util/data/date";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import { addPath, toPath } from "@util/domain/views";
import Input from "@widgets/Input";
import SessionIcon from "@widgets/SessionIcon";
import { useState } from "react";
import { getWeekDayProps, getYearState } from "../calendarState";
import { getScheduleNavigationItems } from "../navigationItems";
import DayHeader from "./DayHeader";
import styles from "./MonthView.module.css";
import Sessions from "./Sessions";
import Week from "./Week";

registerToolbar("MonthView");

export default function MonthView({
	sessions,
	date,
	store,
	playingSession,
}: any) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [popupDate, setPopupDate] = useState<any>(null);
	const isPhone = useDeviceType() === "phone";
	const direction = useDirection();
	const { lastViewMode } = store.useState();
	const translations = useTranslations();
	const firstDay = getMonthViewStart(date);
	const dayHeaderFormatter = useDateFormatter({
		weekday: isPhone ? "narrow" : "short",
	});
	const dayFormatter = useDateFormatter({
		day: "numeric",
	});
	const monthFormatter = useDateFormatter({
		month: isPhone ? "short" : "long",
	});
	const yearFormatter = useDateFormatter({
		year: "numeric",
	});

	// Get the first day of the month from the date prop
	const month = new Date(date);
	month.setDate(1);

	const numWeeks = getNumberOfWeeksInMonth(month);
	const weeks = new Array(numWeeks).fill(0).map((_, index) => {
		const weekFirstDay = addDate(firstDay, index * 7);
		return (
			<Week
				sessions={sessions}
				key={index}
				month={month}
				date={weekFirstDay}
				row={index + 2}
				rowCount={numWeeks + 1}
				dateFormatter={dayFormatter}
				store={store}
				onMenuVisible={setIsMenuOpen}
				onOpenDay={setPopupDate}
				playingSession={playingSession}
			/>
		);
	});

	const dayTitles = getWeekDayProps(firstDay).map((dayProps) => {
		return (
			<DayHeader
				key={dayProps.index}
				{...dayProps}
				dateFormatter={dayHeaderFormatter}
			/>
		);
	});

	const monthState = [
		month.getMonth() + 1,
		(month: any) => {
			const newDate = new Date(date);
			newDate.setMonth(month - 1);
			store.update((s: any) => {
				s.date = newDate;
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
			background={false}
			select={true}
			label={translations.MONTH}
			helperText=""
			fullWidth={false}
			style={{ minWidth: isPhone ? "3.7em" : "10em" }}
			items={monthItems}
			state={monthState}
		/>
	);

	const yearState = getYearState(date, month.getFullYear(), store);
	const yearStart = 2015;
	const yearEnd = new Date().getFullYear() + 2;
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
			background={false}
			select={true}
			label={translations.YEAR}
			helperText=""
			fullWidth={false}
			style={{ minWidth: "5em" }}
			items={yearItems}
			state={yearState}
		/>
	);

	const gotoPreviousMonth = () => {
		const newDate = new Date(month);
		newDate.setMonth(newDate.getMonth() - 1);
		// Don't go before January of yearStart
		if (
			newDate.getFullYear() < yearStart ||
			(newDate.getFullYear() === yearStart && newDate.getMonth() < 0)
		) {
			return;
		}
		store.update((s: any) => {
			s.date = newDate;
		});
	};

	const gotoNextMonth = () => {
		const newDate = new Date(month);
		newDate.setMonth(newDate.getMonth() + 1);
		// Don't go after December of yearEnd
		if (
			newDate.getFullYear() > yearEnd ||
			(newDate.getFullYear() === yearEnd && newDate.getMonth() > 11)
		) {
			return;
		}
		store.update((s: any) => {
			s.date = newDate;
		});
	};

	const today = new Date();
	const hasPreviousMonth =
		month.getMonth() || month.getFullYear() !== yearStart;
	const hasNextMonth =
		month.getMonth() !== 11 || month.getFullYear() !== yearEnd;
	const isToday =
		month.getMonth() == today.getMonth() &&
		month.getFullYear() == today.getFullYear();

	const toolbarItems = [
		...getScheduleNavigationItems({
			store,
			direction,
			translations,
			lastViewMode,
			today: today,
			todayDisabled: isToday,
			menu: false,
		}),
		{
			id: "previousMonth",
			name: translations.PREVIOUS_MONTH,
			icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
			onClick: gotoPreviousMonth,
			disabled: !hasPreviousMonth,
			location: "footer",
		},
		{
			id: "monthWidget",
			divider: true,
			element: monthWidget,
			location: "footer",
		},
		{
			id: "yearWidget",
			element: yearWidget,
			location: "footer",
		},
		{
			id: "nextMonth",
			name: translations.NEXT_MONTH,
			icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
			onClick: gotoNextMonth,
			disabled: !hasNextMonth,
			location: "footer",
		},
	].filter(Boolean);

	useToolbar({
		id: "MonthView",
		items: toolbarItems,
		depends: [translations, month, lastViewMode],
	});

	const swipeHandlers = useSwipe({
		onSwipeLeft: direction === "rtl" ? gotoPreviousMonth : gotoNextMonth,
		onSwipeRight: direction === "rtl" ? gotoNextMonth : gotoPreviousMonth,
	});

	const gotoPreviousDay = () => {
		setPopupDate(addDate(popupDate, -1));
	};

	const gotoNextDay = () => {
		setPopupDate(addDate(popupDate, 1));
	};

	const sessionDate = popupDate && getDateString(popupDate);
	const sessionItems = (sessions || []).filter(
		(session: any) => session.date === sessionDate,
	);
	const popupItems = sessionItems.map((item: any) => {
		const groupName =
			item.group && item.group[0].toUpperCase() + item.group.slice(1);
		const path = `session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
		const icon = <SessionIcon type={item.type} />;
		return {
			id: item.name,
			name: item.name,
			group: item.group,
			date: item.date,
			type: item.type,
			description: groupName,
			backgroundColor: item.color,
			style: { color: getSessionTextColor(item.color) },
			icon,
			target: "#schedule/" + toPath(path),
			onClick: () => addPath(path),
		};
	});

	return (
		<div
			className={styles.root}
			{...(!isMenuOpen && !popupDate && swipeHandlers)}
		>
			<div
				className={styles.grid}
				style={{ gridTemplateRows: `3em repeat(${numWeeks}, 1fr)` }}
			>
				{dayTitles}
				{weeks}
			</div>
			<Sessions
				open={!!popupDate}
				onClose={() => setPopupDate(null)}
				date={popupDate}
				items={popupItems}
				onSwipeLeft={direction === "rtl" ? gotoPreviousDay : gotoNextDay}
				onSwipeRight={direction === "rtl" ? gotoNextDay : gotoPreviousDay}
				direction={direction}
				playingSession={playingSession}
			/>
		</div>
	);
}
