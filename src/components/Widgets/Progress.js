import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
    progress: {
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        alignItems: "center",
        justifyItems: "center",
        flex: "1",
        marginLeft:"0.3em",
        marginRight:"0.3em"
    },
});

export default function Progress({size}) {
    const classes = useStyles();

    return (<div className={classes.progress}>
        <CircularProgress size={size} />
    </div>);
}
