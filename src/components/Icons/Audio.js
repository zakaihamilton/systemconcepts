import AudiotrackOutlined from "@icons/svg/AudiotrackOutlined.svg";
import { forwardRef } from "react";

export default forwardRef(function AudioIcon({ children, ...props }, ref) {
	return (
		<AudiotrackOutlined
			ref={ref}
			style={{ transform: "rotate(16deg)" }}
			{...props}
		>
			{children}
		</AudiotrackOutlined>
	);
});
