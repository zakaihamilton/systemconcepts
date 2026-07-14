import AudiotrackOutlined from "@icons/AudiotrackOutlined";
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
