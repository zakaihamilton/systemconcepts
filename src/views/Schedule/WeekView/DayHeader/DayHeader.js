import { useDeviceType } from "@util/browser/styles";
import { isDateToday } from "@util/data/date";
import clsx from "clsx";
import styles from "./DayHeader.module.css";

export default function DayHeader({
	dateFormatter,
	dayFormatter,
	date,
	index,
	count,
	store,
}) {
	const isPhone = useDeviceType() === "phone";
	const style = {
		gridColumn: index + 1,
		gridRow: 1,
	};
	const onClick = () => {
		store.update((s) => {
			s.date = date;
			s.viewMode = "day";
			s.lastViewMode = "week";
		});
	};
	const dayName = dayFormatter.format(date);
	const dateName = dateFormatter.format(date);
	const isToday = isDateToday(date);
	const className = clsx(
		styles.root,
		isToday && styles.today,
		isPhone && styles.mobile,
		index === count - 1 && styles.last,
	);
	return (
		<div
			className={className}
			style={{ ...style, cursor: "pointer" }}
			onClick={onClick}
		>
			<div className={styles.day}>{dayName}</div>
			<div className={styles.date}>{dateName}</div>
		</div>
	);
}
