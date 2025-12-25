import styles from "./Session.module.scss";
import { addPath, toPath } from "@util/pages";
import { useDeviceType } from "@util/styles";
import { useSessionTextColor } from "@util/colors";
import clsx from "clsx";
import Link from "@mui/material/Link";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@components/Icons/Audio";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export default function Session({ group, year, date, name, color, type, showGroup = true }) {
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

    return <Link underline="none" color="initial" href={href} className={clsx(styles.root, isPhone && styles.mobile)} style={{ color: textColor }} onClick={onClick}>
        <div className={styles.background} style={style} />
        {showGroup && <div className={styles.group} dir="auto">
            {groupName}
        </div>}
        <div className={styles.container}>
            <div className={styles.icons}>
                {type === "video" && <MovieIcon />}
                {type === "audio" && <AudioIcon />}
                {type === "image" && <InsertPhotoOutlinedIcon />}
                {type === "overview" && <MovieFilterIcon />}
                {type === "ai" && <AutoAwesomeIcon />}
            </div>
            <div className={styles.name} dir="auto">
                {name}
            </div>
        </div>
        <div className={styles.backgroundBorder} style={style} />
    </Link>;
}