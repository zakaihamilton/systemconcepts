import styles from "./Term.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import Badge from '@material-ui/core/Badge';
import { makeStyles } from '@material-ui/core/styles';
import { MainStore } from "@/components/Main";
import clsx from "clsx";
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles({
    phase: {
        backgroundColor: ({ fill }) => fill,
        color: "var(--text-color)",
        border: ({ border }) => border
    },
    hover: {
        borderRadius: "0.5em",
        padding: "0.5em",
        border: "1px solid transparent",
        "&:hover": {
            backgroundColor: ({ fill }) => fill,
            color: "var(--text-color)",
            border: ({ border }) => border
        }
    }
});

export default function Term({ id }) {
    const { direction } = MainStore.useState();
    const terms = useTerms();
    const term = terms[id] || {};
    let type = null;
    let phase = null;
    if (term.type) {
        type = terms[term.type];
    }
    if (typeof term.phase !== "undefined") {
        phase = terms["phase." + term.phase];
    }
    let iconTooltip = "";
    let nameTooltip = "";
    let explanationTooltip = "";
    let iconDescription = "";
    const classes = useStyles({ ...phase });
    const { name = "", explanation = "", description = "", concept = "" } = term;
    let { icon } = term;
    const toLines = (text, className) => (text || "").split("\n").map((line, index) => <><span className={className} key={index}>{line}</span><br /></>);
    if (!icon && type) {
        icon = type.icon;
    }
    if (type) {
        iconTooltip = type.name;
        iconDescription = type.description;
    }
    else {
        iconTooltip = name;
    }
    if (description) {
        nameTooltip = <Typography className={styles.tooltip}>
            <span className={styles.label}>{name}</span>
            {toLines(description, styles.description)}
        </Typography>
    }
    if (explanation) {
        explanationTooltip = <Typography className={styles.tooltip}>
            <span className={styles.label}>{concept}</span>
            {toLines(explanation, styles.explanation)}
        </Typography>
    }
    if (phase && phase.name) {
        iconTooltip = <Typography className={styles.tooltip}>
            <span className={styles.label}>{iconTooltip}</span>
            <span className={clsx(classes.phase, styles.phaseTooltip)}>{phase.name}</span>
            {toLines(iconDescription, styles.description)}
        </Typography>;
    }
    return <div className={clsx(styles.root, classes.hover)}>
        {icon && <Tooltip arrow title={iconTooltip}>
            <Badge
                classes={{ badge: classes.phase }}
                badgeContent={phase && phase.id}
                invisible={typeof phase === "undefined"}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: direction === "rtl" ? 'left' : 'right',
                }}
            >
                {icon}
            </Badge>
        </Tooltip>}
        <div className={styles.fields}>
            <Tooltip arrow title={nameTooltip}>
                <div className={styles.name}>
                    {name}
                </div>
            </Tooltip>
            <Tooltip arrow title={explanationTooltip}>
                <div className={styles.concept}>
                    {concept}
                </div>
            </Tooltip>
        </div>
    </div>
}