import AudiotrackOutlinedIcon from "@mui/icons-material/AudiotrackOutlined";
import { forwardRef } from "react";

export default forwardRef(function AudioIcon({ children, ...props }, ref) {
	return (
		<AudiotrackOutlinedIcon
			ref={ref}
			style={{ transform: "rotate(16deg)" }}
			{...props}
		>
			{children}
		</AudiotrackOutlinedIcon>
	);
});
