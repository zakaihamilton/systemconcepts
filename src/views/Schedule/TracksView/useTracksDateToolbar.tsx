import { useToolbar } from "@components/Toolbar";
import Input from "@components/Widgets/Input";
import TodayIcon from "@icons/svg/Today.svg";
import { useDateFormatter } from "@util/data/locale";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface TrackMonthGroup {
	yearMonth: string;
	sessions: any[];
}

interface UseTracksDateToolbarOptions {
	groupedSessions: TrackMonthGroup[];
	listRef: RefObject<any>;
	outerRef: RefObject<HTMLDivElement | null>;
	translations: any;
	isMobile: boolean;
}

/**
 * Syncs year/month jump selectors and the Today action in the TracksView toolbar
 * with the virtualized scroll container.
 */
export function useTracksDateToolbar({
	groupedSessions,
	listRef,
	outerRef,
	translations,
	isMobile,
}: UseTracksDateToolbarOptions) {
	const [selectedYear, setSelectedYear] = useState("");
	const [selectedMonth, setSelectedMonth] = useState("");
	const dateFormatter = useDateFormatter({ month: "long" });

	const dateOptions = useMemo(() => {
		const years = new Set<string>();
		const monthsByYear: Record<string, Set<string>> = {};

		groupedSessions.forEach((group) => {
			const [y, m] = group.yearMonth.split("-");
			years.add(y);

			if (!monthsByYear[y]) monthsByYear[y] = new Set<string>();
			monthsByYear[y].add(m);
		});

		return {
			years: Array.from(years).sort((a, b) => b.localeCompare(a)),
			monthsByYear,
		};
	}, [groupedSessions]);

	const onItemsRendered = useCallback(
		({ visibleStartIndex }: any) => {
			if (
				visibleStartIndex >= 0 &&
				visibleStartIndex < groupedSessions.length
			) {
				const yearMonth = groupedSessions[visibleStartIndex].yearMonth;
				const [y, m] = yearMonth.split("-");

				setSelectedYear((prev) => (prev !== y ? y : prev));
				setSelectedMonth((prev) => (prev !== m ? m : prev));
			}
		},
		[groupedSessions],
	);

	const scrollToDate = useCallback(
		(year: string, month: string) => {
			let prefix = `${year}`;
			if (month) prefix += `-${month}`;

			const index = groupedSessions.findIndex((g) =>
				g.yearMonth.startsWith(prefix),
			);
			if (index !== -1 && listRef.current) {
				listRef.current.scrollToItem(index, "start");
			}
		},
		[groupedSessions, listRef],
	);

	const gotoToday = useCallback(() => {
		if (listRef.current) {
			listRef.current.scrollToItem(0, "start");
		}
	}, [listRef]);

	const yearState = useMemo(
		() => [
			selectedYear,
			(year: string) => {
				setSelectedYear(year);
				setSelectedMonth("");
				scrollToDate(year, "");
			},
		],
		[selectedYear, scrollToDate],
	);

	const monthState = useMemo(
		() => [
			selectedMonth,
			(month: string) => {
				setSelectedMonth(month);
				if (selectedYear) {
					scrollToDate(selectedYear, month);
				}
			},
		],
		[selectedMonth, selectedYear, scrollToDate],
	);

	useEffect(() => {
		if (selectedYear === "" && dateOptions.years.length > 0) {
			const firstGroup = groupedSessions[0];
			if (firstGroup) {
				const [y, m] = firstGroup.yearMonth.split("-");
				setTimeout(() => {
					setSelectedYear(y);
					setSelectedMonth(m);
				}, 0);
			}
		}
	}, [dateOptions.years, selectedYear, groupedSessions]);

	const yearItems = useMemo(
		() => dateOptions.years.map((y) => ({ id: y, name: y })),
		[dateOptions.years],
	);

	const availableMonths = useMemo(() => {
		if (!selectedYear || !dateOptions.monthsByYear[selectedYear]) return [];
		return Array.from(dateOptions.monthsByYear[selectedYear])
			.sort((a, b) => b.localeCompare(a))
			.map((m) => {
				const date = new Date(parseInt(selectedYear), parseInt(m) - 1, 1);
				return { id: m, name: dateFormatter.format(date) };
			});
	}, [selectedYear, dateOptions, dateFormatter]);

	const monthItems = useMemo(() => [...availableMonths], [availableMonths]);

	const yearWidget = useMemo(
		() => (
			<Input
				select={true}
				label={translations.YEAR}
				helperText=""
				fullWidth={false}
				style={{ minWidth: "6em" }}
				items={yearItems}
				state={yearState}
			/>
		),
		[translations, yearItems, yearState],
	);

	const monthWidget = useMemo(
		() => (
			<Input
				select={true}
				label={translations.MONTH}
				helperText=""
				fullWidth={false}
				style={{ minWidth: "8em" }}
				items={monthItems}
				state={monthState}
				disabled={!selectedYear}
			/>
		),
		[translations, monthItems, monthState, selectedYear],
	);

	const [isAtTop, setIsAtTop] = useState(true);

	useEffect(() => {
		const checkScrollPosition = () => {
			if (outerRef.current) {
				setIsAtTop(outerRef.current.scrollTop === 0);
			}
		};

		checkScrollPosition();

		const handleScroll = () => checkScrollPosition();
		const scrollElement = outerRef.current;
		if (scrollElement) {
			scrollElement.addEventListener("scroll", handleScroll);
			return () => scrollElement.removeEventListener("scroll", handleScroll);
		}
	}, [outerRef]);

	const toolbarItems = useMemo(
		() => [
			{
				id: "today",
				name: translations.TODAY,
				icon: <TodayIcon />,
				onClick: gotoToday,
				disabled: isAtTop,
				location: "header",
				menu: false,
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
		],
		[translations, gotoToday, isAtTop, monthWidget, yearWidget],
	);

	useToolbar({
		id: "TracksView",
		items: toolbarItems,
		depends: [translations, selectedYear, selectedMonth, isMobile, isAtTop],
	});

	return { onItemsRendered };
}
