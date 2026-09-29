import AutoAwesomeIcon from "@icons/svg/AutoAwesome.svg";
import ExpandLessIcon from "@icons/svg/ExpandLess.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import GraphicEqIcon from "@icons/svg/GraphicEq.svg";
import MovieIcon from "@icons/svg/Movie.svg";
import Chip from "@ui/Chip";
import { SessionsStore } from "@util/domain/sessions";
import Group from "@widgets/Group";
import Image from "@widgets/Image";
import Label from "@widgets/Label";
import Row from "@widgets/Row";
import SessionIcon from "@widgets/SessionIcon";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import styles from "./Sessions.module.css";

export function renderSessionColumn(
	columnId: any,
	item: any,
	{ viewMode, target, gotoItem, handleIconClick, formatDate }: any,
) {
	switch (columnId) {
		case "name":
		case "nameWidget": {
			const style: Record<string, any> = {};

			if (item.isGroupHeader) {
				const toggleFolder = (e: any) => {
					e.preventDefault();
					e.stopPropagation();
					SessionsStore.update((s) => {
						const expanded = s.expandedTreeGroups || [];
						if (expanded.includes(item.prefix)) {
							s.expandedTreeGroups = expanded.filter((p) => p !== item.prefix);
						} else {
							s.expandedTreeGroups = [...expanded, item.prefix];
						}
					});
				};
				const icon = (
					<div className={styles.icon} onClick={toggleFolder}>
						{item.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</div>
				);
				const nameContent = (
					<div className={styles.nameContainer}>
						<span
							className={clsx(styles.labelText, styles.singleLine)}
							style={{ fontWeight: "bold" }}
						>
							{item.name}{" "}
							<span style={{ opacity: 0.7, fontSize: "0.9em" }}>
								({item.count})
							</span>
						</span>
					</div>
				);
				return (
					<Row onClick={toggleFolder} icons={icon}>
						{nameContent}
					</Row>
				);
			}

			const icon = (
				<div
					style={style}
					className={styles.icon}
					onClick={() => handleIconClick(item.type)}
					id={item.type}
				>
					<SessionIcon type={item.type} />
				</div>
			);

			const nameContentInner = (
				<span
					className={clsx(
						styles.labelText,
						viewMode !== "grid" && styles.singleLine,
						viewMode === "grid" && styles.gridLineClamp,
					)}
				>
					{item.name}
					{viewMode !== "grid" && (
						<div
							className={clsx(
								styles.percentageContainer,
								item.percentage && styles.visible,
							)}
						>
							<div
								className={styles.percentage}
								style={{ width: item.percentage + "%" }}
							/>
						</div>
					)}
				</span>
			);

			const nameContent = (
				<Tooltip title={item.name}>
					<div className={styles.nameContainer}>{nameContentInner}</div>
				</Tooltip>
			);

			const href = target(item);
			return viewMode === "grid" ? (
				<Label
					className={clsx(styles.labelName, styles[viewMode])}
					icon={viewMode !== "grid" && icon}
					name={nameContent}
				/>
			) : (
				<Row href={href} onClick={() => gotoItem(item)} icons={icon}>
					{nameContent}
				</Row>
			);
		}

		case "thumbnail":
		case "thumbnailWidget": {
			if (item.isGroupHeader) {
				return null;
			}
			const shouldShowImage = viewMode === "grid";
			const altIcon = (
				<>
					{item.video ? (
						<MovieIcon fontSize="large" />
					) : (
						<GraphicEqIcon fontSize="large" />
					)}
				</>
			);

			const aiBadge = item.ai && viewMode === "grid" && (
				<Tooltip title="AI Summary Available">
					<div className={styles.aiBadge}>
						<AutoAwesomeIcon />
						<span className={styles.aiText}>AI</span>
					</div>
				</Tooltip>
			);

			const progressBar = typeof item.percentage === "number" &&
				!isNaN(item.percentage) &&
				item.percentage > 0 &&
				viewMode === "grid" && (
					<div className={clsx(styles.gridProgressBar, styles.visible)}>
						<div
							className={styles.gridProgressFill}
							style={{ width: item.percentage + "%" }}
						/>
					</div>
				);

			return (
				<div className={styles.thumbnailContainer}>
					<Image
						href={target(item)}
						onClick={() => gotoItem(item)}
						path={shouldShowImage ? item.thumbnail : null}
						width={viewMode === "grid" ? null : "12em"}
						height={viewMode === "grid" ? null : "9em"}
						alt={altIcon}
						loading="lazy"
					/>
					{aiBadge}
					{progressBar}
				</div>
			);
		}

		case "group":
		case "groupWidget":
			return (
				<Group
					fill={viewMode === "grid"}
					name={item.group}
					color={item.color}
					className={
						viewMode === "grid"
							? styles.gridGroupContainer
							: styles.listGroupContainer
					}
				/>
			);

		case "date": {
			if (item.isGroupHeader) {
				return null;
			}
			const formatted = formatDate(item.date);
			if (viewMode === "grid") {
				return (
					<div className={styles.gridDateBadge}>
						<span className={styles.gridDateText}>{formatted}</span>
					</div>
				);
			}
			return (
				<div className={styles.dateBadge}>
					<span className={styles.dateText}>{formatted}</span>
				</div>
			);
		}

		case "duration":
		case "durationWidget":
			return item.formattedDuration;

		case "tags":
		case "tagsWidget":
			return item.tags.length ? (
				<div className={styles.tags}>
					{item.tags.map((tag: any) => (
						<Chip key={tag} label={tag} size="small" className={styles.tag} />
					))}
				</div>
			) : null;

		default:
			return item[columnId];
	}
}
