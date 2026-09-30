import { addDate } from "@util/data/date";

export function getWeekDayProps(firstDay: Date) {
	return Array.from({ length: 7 }, (_, index) => ({
		date: addDate(firstDay, index),
		index,
		count: 7,
	}));
}

export function getYearState(
	date: Date,
	year: number,
	store: {
		update: (callback: (state: { date: Date }) => void) => void;
	},
): [number, (year: number) => void] {
	return [
		year,
		(nextYear) => {
			const nextDate = new Date(date);
			nextDate.setFullYear(nextYear);
			store.update((state) => {
				state.date = nextDate;
			});
		},
	];
}
