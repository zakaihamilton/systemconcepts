import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EventIcon from "@mui/icons-material/Event";
import { getContrastColor } from "@util/data/color";
import { formatDuration } from "@util/data/string";
import { useDateFormatter } from "@util/data/locale";
import Image from "@widgets/Image";
import SessionIcon from "@widgets/SessionIcon";
import clsx from "clsx";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import styles from "./Card.module.css";

const TrackCard = memo(function TrackCard({
	session,
	isActive,
	onSessionClick,
	isPlaying,
}) {
	const rootRef = useRef(null);
	const dateFormatter = useDateFormatter({
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	const formatDate = useCallback((dateStr) => {
		if (!dateStr) return "";
		const parts = dateStr.split("-");
		if (parts.length === 3) {
			const year = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10) - 1;
			const day = parseInt(parts[2], 10);
			const d = new Date(year, month, day);
			if (!isNaN(d.getTime())) {
				return dateFormatter.format(d);
			}
		}
		return dateStr;
	}, [dateFormatter]);

	const { thumbnail, name, duration, color, group, id } = session;

	const [showThumbnail, setShowThumbnail] = useState(
		typeof thumbnail === "string",
	);
	const [imageLoaded, setImageLoaded] = useState(false);
	const [prevId, setPrevId] = useState(id);
	const [prevThumbnail, setPrevThumbnail] = useState(thumbnail);

	if (id !== prevId || thumbnail !== prevThumbnail) {
		setPrevId(id);
		setPrevThumbnail(thumbnail);
		setShowThumbnail(typeof thumbnail === "string");
		setImageLoaded(false);
	}

	useEffect(() => {
		if (typeof thumbnail === "string") {
			return;
		}
		const timer = setTimeout(() => {
			setShowThumbnail(true);
		}, 1000);
		return () => clearTimeout(timer);
	}, [id, thumbnail]);

	const handleClick = useCallback(() => {
		if (onSessionClick) {
			onSessionClick(session);
		}
	}, [onSessionClick, session]);

	const groupColor = color || "#424242";
	const hasThumbnail = showThumbnail && !!thumbnail;
	const textColor = getContrastColor(groupColor);

	// Show gradient if image is not loaded yet (or no thumbnail exists)
	const showGradient = !imageLoaded;

	const backgroundStyle = showGradient
		? {
				background: `linear-gradient(135deg, ${groupColor} 0%, #1a1a1a 100%)`,
			}
		: undefined;

	return (
		<div
			ref={rootRef}
			className={clsx(
				styles.card,
				isActive && styles.active,
				isPlaying && styles.playing,
			)}
			onClick={handleClick}
		>
			<div className={styles.cardInner} style={backgroundStyle}>
				<Image
					path={hasThumbnail ? thumbnail : null}
					className={styles.thumbnail}
					width="100%"
					height="100%"
					alt={hasThumbnail ? name : ""}
					loading="lazy"
					showProgress={false}
					onLoad={() => setImageLoaded(true)}
				/>
				<div className={styles.overlay}>
					<div className={styles.info}>
						<Tooltip title={name} arrow>
							<Typography variant="subtitle2" className={styles.title} noWrap>
								{name}
							</Typography>
						</Tooltip>
						<div className={styles.details}>
							<div className={styles.dateContainer}>
								<EventIcon className={styles.dateIcon} />
								<Typography variant="caption" className={styles.date}>
									{formatDate(session.date)}
								</Typography>
							</div>
							<Typography variant="caption" className={styles.duration}>
								{duration && session.type !== "image"
									? formatDuration(duration * 1000, true)
									: ""}
							</Typography>
						</div>
					</div>
				</div>
				<div
					className={styles.groupPill}
					style={{ backgroundColor: groupColor, color: textColor }}
				>
					{group}
				</div>
				{session.position > 0 && session.duration > 0 && (
					<div className={styles.progressContainer}>
						<div
							className={styles.progressBar}
							style={{
								width: `${Math.min(100, (session.position / session.duration) * 100)}%`,
							}}
						/>
					</div>
				)}
				<div className={styles.typeIcon}>
					<SessionIcon type={session.type} />
				</div>
			</div>
		</div>
	);
});

export default TrackCard;
