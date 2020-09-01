import styles from "./Term.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import Badge from '@material-ui/core/Badge';
import { makeStyles } from '@material-ui/core/styles';
import { MainStore } from "@/components/Main";

const useStyles = makeStyles({
    badge: {
        backgroundColor: ({ fill }) => fill,
        color: "var(--text-color)",
        border: ({ border }) => border
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
    const classes = useStyles({ ...phase });
    const { name = "", explanation = "" } = term;
    let { icon, tooltip = "" } = term;
    if (!icon && type) {
        icon = type.icon;
    }
    if (!tooltip && type) {
        tooltip = type.tooltip || type.name;
    }
    else {
        tooltip = name;
    }
    return <div className={styles.row}>
        {icon && <Tooltip arrow title={tooltip}>
            <Badge
                classes={{ badge: classes.badge }}
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
        <div className={styles.label}>
            <div className={styles.name}>
                {name}
            </div>
            <div className={styles.explanation}>
                {explanation}
            </div>
        </div>
    </div>
}