import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';

const useStyles = makeStyles({
    progress: {
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        alignItems: "center",
        justifyItems: "center",
        flex: "1",
        marginLeft: "0.3em",
        marginRight: "0.3em"
    },
});

export default function Progress({ size, value, tooltip = "", variant, ...props }) {
    const text = typeof value !== "undefined" && `${Math.round(value)}%`;
    const classes = useStyles();

    return (<div className={classes.progress} {...props}>
        <Box position="relative" display="flex">
            <CircularProgress size={size} value={value} variant={variant} />
            <Box
                top={0}
                left={0}
                bottom={0}
                right={0}
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                {text && <Tooltip title={tooltip}>
                    <Typography variant="caption" component="div" color="textSecondary">{text}</Typography>
                </Tooltip>}
            </Box>
        </Box>
    </div>);
}
