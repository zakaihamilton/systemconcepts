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
import badgeStyles from "./SessionBadges.module.css";
import gridStyles from "./SessionsGrid.module.css";
import listStyles from "./SessionsList.module.css";

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
					<div className={listStyles.icon} onClick={toggleFolder}>
						{item.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</div>
				);
				const nameContent = (
					<div className={listStyles.nameContainer}>
						<span
							className={clsx(listStyles.labelText, listStyles.singleLine)}
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
					className={listStyles.icon}
					onClick={() => handleIconClick(item.type)}
					id={item.type}
				>
					<SessionIcon type={item.type} />
				</div>
			);

			const nameContentInner = (
				<span
					className={clsx(
						viewMode === "grid" ? gridStyles.labelText : listStyles.labelText,
						viewMode !== "grid" && listStyles.singleLine,
						viewMode === "grid" && gridStyles.gridLineClamp,
					)}
				>
					{item.name}
					{viewMode !== "grid" && (
						<div
							className={clsx(
								listStyles.percentageContainer,
								item.percentage && listStyles.visible,
							)}
						>
							<div
								className={listStyles.percentage}
								style={{ width: item.percentage + "%" }}
							/>
						</div>
					)}
				</span>
			);

			const nameContent = (
				<Tooltip title={item.name}>
					<div className={listStyles.nameContainer}>{nameContentInner}</div>
				</Tooltip>
			);

			const href = target(item);
			return viewMode === "grid" ? (
				<Label
					className={clsx(gridStyles.labelName, gridStyles.grid)}
					icon={false}
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
					<div className={badgeStyles.aiBadge}>
						<AutoAwesomeIcon />
						<span className={badgeStyles.aiText}>AI</span>
					</div>
				</Tooltip>
			);

			const progressBar = typeof item.percentage === "number" &&
				!isNaN(item.percentage) &&
				item.percentage > 0 &&
				viewMode === "grid" && (
					<div className={clsx(gridStyles.gridProgressBar, gridStyles.visible)}>
						<div
							className={gridStyles.gridProgressFill}
							style={{ width: item.percentage + "%" }}
						/>
					</div>
				);

			return (
				<div className={gridStyles.thumbnailContainer}>
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
							? badgeStyles.gridGroupContainer
							: badgeStyles.listGroupContainer
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
					<div className={badgeStyles.gridDateBadge}>
						<span className={badgeStyles.gridDateText}>{formatted}</span>
					</div>
				);
			}
			return (
				<div className={badgeStyles.dateBadge}>
					<span className={badgeStyles.dateText}>{formatted}</span>
				</div>
			);
		}

		case "duration":
		case "durationWidget":
			return item.formattedDuration;

		case "tags":
		case "tagsWidget":
			return item.tags.length ? (
				<div className={badgeStyles.tags}>
					{item.tags.map((tag: any) => (
						<Chip
							key={tag}
							label={tag}
							size="small"
							className={badgeStyles.tag}
						/>
					))}
				</div>
			) : null;

		default:
			return item[columnId];
	}
}
