import styles from "./SessionGroup.module.scss";
import Session from "./Session";
import { useTheme, getContrastRatio } from "@mui/material/styles";

export default function SessionGroup({ group, sessions }) {
    const theme = useTheme();
    const groupLabel = group[0].toUpperCase() + group.slice(1);
    const firstSession = sessions[0];
    const groupColor = firstSession.color;

    let textColor = theme.palette.text.primary;
    if (groupColor) {
        const contrastWhite = getContrastRatio(groupColor, '#ffffff');
        const contrastBlack = getContrastRatio(groupColor, '#000000');
        textColor = contrastWhite >= contrastBlack ? '#ffffff' : '#000000';
    }

    return <div className={styles.root}>
        <div className={styles.title} style={{ backgroundColor: groupColor, color: textColor }}>
            {groupLabel}
        </div>
        <div className={styles.items}>
            {sessions
                .sort((a, b) => (a.typeOrder || 0) - (b.typeOrder || 0))
                .map(session => {
                    const { name, key, ...props } = session;
                    return <Session key={name} name={name} {...props} />;
                })}
        </div>
    </div>;
}
