import styles from "./Session.module.scss";
import { addPath, toPath } from "@util/pages";
import { useSessionTextColor } from "@util/colors";
import Link from "@mui/material/Link";
import SessionIcon from "@widgets/SessionIcon";

import clsx from "clsx";

export default function Session({ group, year, date, name, color, type, isPlaying }) {
    const textColor = useSessionTextColor(color);
    const path = `session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`;

    const onClick = () => {
        addPath(path);
    };

    const href = "#schedule/" + toPath(path);

    const style = {
        backgroundColor: color
    };

    return <Link underline="none" color="initial" href={href} className={clsx(styles.root, isPlaying && styles.playing)} style={{ color: textColor }} onClick={onClick}>
        <div className={styles.background} style={style} />
        <div className={styles.container}>
            <div className={styles.icons}>
                <SessionIcon type={type} />
            </div>
            <div className={styles.text}>
                <div className={styles.name} dir="auto">
                    {name}
                </div>
            </div>
        </div>
        <div className={styles.backgroundBorder} style={style} />
    </Link>;
}