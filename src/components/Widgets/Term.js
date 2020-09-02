import styles from "./Term.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import Badge from '@material-ui/core/Badge';
import { makeStyles } from '@material-ui/core/styles';
import { MainStore } from "@/components/Main";
import clsx from "clsx";
import Typography from '@material-ui/core/Typography';
import { useLanguage } from "@/util/language";

const useStyles = makeStyles({
    phase: {
        backgroundColor: ({ fill }) => fill,
        color: "var(--text-color)",
        border: ({ border }) => border
    },
    phaseTooltip: {
        borderRadius: "0.5em",
        padding: "0.5em",
        backgroundColor: ({ fill }) => fill,
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
    const language = useLanguage();
    const terms = useTerms();
    const term = terms[id] || { original: {} };
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
    const hebrew = language !== "heb" && term.original.name && term.original.name.heb;
    const classes = useStyles({ ...phase });
    const { name = "", explanation = "", description = "", concept = "", transliteration = "" } = term;
    let { icon } = term;
    const toLines = (text, ...props) => (text || "").split("\n").map((line, index) => <><span {...props} key={index}>{line}</span><br /></>);
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
    if (description || transliteration || hebrew) {
        nameTooltip = <Typography className={styles.tooltip}>
            {transliteration && <span className={styles.field}>{transliteration}</span>}
            {hebrew && <span className={styles.field}>{hebrew}</span>}
            {toLines(description)}
        </Typography>
    }
    if (explanation) {
        explanationTooltip = <Typography className={styles.tooltip}>
            <span className={styles.label}>{concept}</span>
            {toLines(explanation)}
        </Typography>
    }
    if (phase && phase.name) {
        iconTooltip = <Typography className={styles.tooltip}>
            <span className={styles.label}>{iconTooltip}</span>
            <span className={clsx(classes.phaseTooltip)}>{phase.name}</span>
            {toLines(iconDescription)}
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