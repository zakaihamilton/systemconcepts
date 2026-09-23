import AudiotrackOutlined from "@icons/svg/AudiotrackOutlined.svg";
import { forwardRef } from "react";

export default forwardRef<any, any>(function AudioIcon(
	{ children, ...props }: any,
	ref,
) {
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
