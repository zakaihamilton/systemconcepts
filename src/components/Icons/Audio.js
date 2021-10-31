import { forwardRef } from "react";
import AudiotrackOutlinedIcon from "@material-ui/icons/AudiotrackOutlined";

export default forwardRef(function AudioIcon({ children, ...props }, ref) {
    return <AudiotrackOutlinedIcon ref={ref} style={{ transform: "rotate(16deg)" }} {...props}>
        {children}
    </AudiotrackOutlinedIcon>;
});