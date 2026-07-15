import Box from "@ui/Box";
import CircularProgress from "@ui/CircularProgress";
import Typography from "@ui/Typography";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import styles from "./Progress.module.css";

export default function Progress({
	size,
	value,
	tooltip = "",
	fullscreen,
	variant,
	alignItems,
	justifyContent,
	style,
	...props
}) {
	const text = typeof value !== "undefined" && `${Math.round(value)}%`;
	const rootStyle = {
		...(alignItems && { alignItems }),
		...(justifyContent && { justifyContent }),
		...style,
	};

	return (
		<div
			className={clsx(styles.root, fullscreen && styles.fullscreen)}
			style={rootStyle}
			{...props}
		>
			<Box className={styles.progressWrap}>
				<CircularProgress size={size} value={value} variant={variant} />
				<Box className={styles.progressOverlay}>
					{text && (
						<Tooltip title={tooltip}>
							<Typography
								variant="caption"
								component="div"
								color="textSecondary"
							>
								{text}
							</Typography>
						</Tooltip>
					)}
				</Box>
			</Box>
		</div>
	);
}
