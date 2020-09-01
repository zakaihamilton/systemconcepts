import styles from "./Term.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import ErrorIcon from '@material-ui/icons/Error';

export default function Term({ id }) {
    const terms = useTerms();
    const term = terms[id] || {};
    let type = null;
    if (term.type) {
        type = terms[term.type];
    }
    const { name = "", explanation = "" } = term;
    let { icon, tooltip = "" } = term;
    console.log(type);
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
            {icon}
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