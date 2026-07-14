import ExpandLessIcon from "@icons/ExpandLess";
import ExpandMoreIcon from "@icons/ExpandMore";
import { useDeviceType } from "@util/browser/styles";
import { getDateString } from "@util/data/date";
import clsx from "clsx";
import Session from "../Session";
import styles from "./Day.module.css";

function groupSessionsByGroup(sessions) {
	return sessions.reduce((groups, session) => {
		const group = session.group || "";
		if (!groups[group]) {
			groups[group] = [];
		}
		groups[group].push(session);
		return groups;
	}, {});
}

export default function Day({
	sessions,
	column,
	row,
	count,
	date,
	playingSession,
	collapsedGroups,
	onToggleGroup,
}) {
	const isPhone = useDeviceType() === "phone";
	const style = {
		gridColumn: column,
		gridRow: row,
	};
	const sessionDate = getDateString(date);
	const daySessions = (sessions || []).filter(
		(session) => session.date === sessionDate,
	);
	const groups = groupSessionsByGroup(daySessions);
	const sessionItems = Object.keys(groups)
		.sort((a, b) => a.localeCompare(b))
		.map((group) => {
			const groupSessions = groups[group].sort(
				(a, b) => (a.typeOrder || 0) - (b.typeOrder || 0),
			);
			const groupName = group && group[0].toUpperCase() + group.slice(1);
			const groupColor = groupSessions[0]?.color;
			const isCollapsed = collapsedGroups?.includes(group);

			return (
				<section
					className={clsx(styles.group, isCollapsed && styles.collapsed)}
					key={group || "ungrouped"}
				>
					<button
						type="button"
						className={styles.groupHeader}
						onClick={() => onToggleGroup(group)}
						aria-expanded={!isCollapsed}
					>
						<span
							className={styles.groupSwatch}
							style={{ backgroundColor: groupColor }}
						/>
						<span className={styles.groupName} dir="auto">
							{groupName}
						</span>
						<span className={styles.groupCount}>{groupSessions.length}</span>
						<span className={styles.groupToggle}>
							{isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
						</span>
					</button>
					<div
						className={clsx(
							styles.groupSessionsFrame,
							isCollapsed && styles.collapsed,
						)}
					>
						<div className={styles.groupSessions}>
							{groupSessions.map((session) => {
								const { name, key, ...sessionProps } = session;
								return (
									<Session
										key={key || name}
										name={name}
										{...sessionProps}
										showGroup={false}
										isPlaying={
											playingSession &&
											playingSession.name === name &&
											playingSession.group === session.group &&
											playingSession.date === session.date
										}
									/>
								);
							})}
						</div>
					</div>
				</section>
			);
		});
	return (
		<div
			className={clsx(
				styles.root,
				column === count && styles.last,
				isPhone && styles.mobile,
			)}
			style={style}
		>
			<div className={clsx(styles.sessions, isPhone && styles.mobile)}>
				{sessionItems}
			</div>
		</div>
	);
}
