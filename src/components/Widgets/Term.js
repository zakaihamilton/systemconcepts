import styles from "./Term.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import Badge from '@material-ui/core/Badge';
import { makeStyles } from '@material-ui/core/styles';
import { MainStore } from "@/components/Main";
import clsx from "clsx";
import { useLanguage } from "@/util/language";
import { useTranslations } from "@/util/translations";

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

export default function Term({ id, onClick, ...props }) {
    const { direction } = MainStore.useState();
    const language = useLanguage();
    const terms = useTerms();
    const translations = useTranslations();
    const term = terms[id] || { original: {} };
    let type = null;
    let phase = null;
    if (term.type) {
        type = terms[term.type];
    }
    if (typeof term.phase !== "undefined") {
        phase = terms["phase." + term.phase];
    }
    else if (term.type === "phase") {
        phase = terms["phase." + term.id];
    }
    let iconTooltip = "";
    let nameTooltip = "";
    let explanationTooltip = "";
    let iconDescription = "";
    const hebrew = language !== "heb" && term.original.name && term.original.name.heb;
    const classes = useStyles({ ...phase });
    const { name = "", explanation = "", description = "", concept = "", transliteration = "" } = term;
    let { icon } = term;
    const toLines = (text, ...props) => (text || "").split("\n").map((line, index) => <React.Fragment key={index}><span {...props}>{line}</span><br /></React.Fragment>);
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
        nameTooltip = <div className={styles.tooltip}>
            {transliteration && <div className={styles.field}>
                <div className={styles.fieldLabel}>
                    {translations.TRANSLITERATION}
                </div>
                <div className={styles.fieldValue}>
                    {transliteration}
                </div>
            </div>}
            {hebrew && <div className={styles.field}>
                <div className={styles.fieldLabel}>
                    {translations.HEBREW}
                </div>
                <div className={styles.fieldValue}>
                    {hebrew}
                </div>
            </div>}
            {toLines(description)}
        </div>
    }
    if (explanation) {
        explanationTooltip = <div className={styles.tooltip}>
            <span className={styles.label}>{concept}</span>
            {toLines(explanation)}
        </div>
    }
    if (phase && phase.name) {
        iconTooltip = <div className={styles.tooltip}>
            <div className={styles.field}>
                <div className={styles.fieldLabel}>
                    {translations.TYPE}
                </div>
                <div className={styles.fieldValue}>
                    {type ? type.name : name}
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.fieldLabel}>
                    {translations.PHASE}
                </div>
                <div className={styles.fieldValue}>
                    {phase.name}
                </div>
            </div>
            {toLines(iconDescription)}
        </div >;
    }
    return <div className={clsx(styles.root, classes.hover, onClick && styles.selectable)} onClick={onClick ? onClick : undefined} {...props}>
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