import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
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
			<Box sx={{ position: "relative", display: "flex" }}>
				<CircularProgress size={size} value={value} variant={variant} />
				<Box
					sx={{
						top: 0,
						left: 0,
						bottom: 0,
						right: 0,
						position: "absolute",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
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
