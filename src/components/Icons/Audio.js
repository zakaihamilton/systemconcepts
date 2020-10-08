import AudiotrackOutlinedIcon from '@material-ui/icons/AudiotrackOutlined';

export default React.forwardRef(function AudioIcon({ children, ...props }, ref) {
    return <AudiotrackOutlinedIcon ref={ref} style={{ transform: "rotate(16deg)" }} {...props}>
        {children}
    </AudiotrackOutlinedIcon>
});