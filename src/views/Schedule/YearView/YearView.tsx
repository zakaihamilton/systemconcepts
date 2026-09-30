import { registerToolbar, useToolbar } from "@components/Toolbar";
import ChevronLeftIcon from "@icons/svg/ChevronLeft.svg";
import ChevronRightIcon from "@icons/svg/ChevronRight.svg";
import { useSwipe } from "@util/browser/touch";
import { getYearNames } from "@util/data/date";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import Input from "@widgets/Input";
import { getYearState } from "../calendarState";
import { getScheduleNavigationItems } from "../navigationItems";
import Month from "./Month";
import styles from "./YearView.module.css";

registerToolbar("YearView");

export default function YearView({
	sessions,
	date,
	store,
	playingSession,
}: any) {
	const { lastViewMode } = store.useState();
	const direction = useDirection();
	const translations = useTranslations();
	const yearFormatter = useDateFormatter({ year: "numeric" });

	const currentYear = date.getFullYear();

	const months = new Array(12).fill(0).map((_, index) => {
		const monthDate = new Date(currentYear, index, 1);
		return (
			<Month
				key={index}
				date={monthDate}
				sessions={sessions}
				store={store}
				playingSession={playingSession}
			/>
		);
	});

	const yearState = getYearState(date, currentYear, store);
	const yearStart = 2015;
	const yearEnd = new Date().getFullYear() + 2;
	const yearItems = getYearNames(
		new Date(currentYear, 0, 1),
		yearFormatter,
		yearStart,
		yearEnd,
	).map((name, index) => ({
		id: yearStart + index,
		name,
	}));
	const yearWidget = (
		<Input
			select={true}
			label={translations.YEAR}
			helperText=""
			fullWidth={false}
			style={{ minWidth: "5em" }}
			items={yearItems}
			state={yearState}
		/>
	);

	const gotoPreviousYear = () => {
		const newDate = new Date(date);
		newDate.setFullYear(currentYear - 1);
		store.update((s: any) => {
			s.date = newDate;
		});
	};

	const gotoNextYear = () => {
		const newDate = new Date(date);
		newDate.setFullYear(currentYear + 1);
		store.update((s: any) => {
			s.date = newDate;
		});
	};

	const toolbarItems = [
		...getScheduleNavigationItems({
			store,
			direction,
			translations,
			lastViewMode,
			today: () => new Date(),
			menu: false,
		}),
		{
			id: "previousYear",
			name: translations.PREVIOUS_YEAR,
			icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
			onClick: gotoPreviousYear,
			location: "footer",
		},
		{
			id: "yearWidget",
			element: yearWidget,
			location: "footer",
		},
		{
			id: "nextYear",
			name: translations.NEXT_YEAR,
			icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
			onClick: gotoNextYear,
			location: "footer",
		},
	].filter(Boolean);

	useToolbar({
		id: "YearView",
		items: toolbarItems,
		depends: [translations, currentYear, lastViewMode],
	});

	const swipeHandlers = useSwipe({
		onSwipeLeft: direction === "rtl" ? gotoPreviousYear : gotoNextYear,
		onSwipeRight: direction === "rtl" ? gotoNextYear : gotoPreviousYear,
	});

	return (
		<div className={styles.root} {...swipeHandlers}>
			{months}
		</div>
	);
}
