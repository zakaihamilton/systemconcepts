import styles from "./Session.module.scss";
import { addPath, toPath } from "@util/pages";
import { useDeviceType } from "@util/styles";
import { useSessionTextColor } from "@util/colors";
import clsx from "clsx";
import Link from "@mui/material/Link";
import SessionIcon from "@widgets/SessionIcon";
import { Tooltip } from "@mui/material";

export default function Session({ group, year, date, name, color, type, isPlaying }) {
    const isPhone = useDeviceType() === "phone";
    const textColor = useSessionTextColor(color);
    const groupName = group && (group[0].toUpperCase() + group.slice(1));
    const path = `session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`;

    const onClick = () => {
        addPath(path);
    };

    const href = "#schedule/" + toPath(path);

    const style = {
        backgroundColor: color
    };

    return <Tooltip title={name}>
        <Link underline="none" color="initial" href={href} className={clsx(styles.root, isPhone && styles.mobile, isPlaying && styles.playing)} style={{ color: textColor }} onClick={onClick}>
            <div className={styles.background} style={style} />
            <div className={clsx(styles.group, isPhone && styles.mobile)} dir="auto">
                {groupName}
            </div>
            <div className={styles.container}>
                <div className={styles.icons}>
                    <SessionIcon type={type} />
                </div>
                <div className={styles.text}>
                    <div className={clsx(styles.name, isPhone && styles.mobile)} dir="auto">
                        {name}
                    </div>
                </div>
            </div>
            <div className={styles.backgroundBorder} style={style} />
        </Link>
    </Tooltip>;
}