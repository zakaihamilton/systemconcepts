import styles from "./Session.module.scss";
import { useTranslations } from "@/util/translations";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { addPath } from "@/util/pages";
import MovieIcon from '@material-ui/icons/Movie';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import { useDeviceType } from "@/util/styles";
import clsx from "clsx";

export function SessionItem({ group, year, date, name, type, suffix }) {
    const translations = useTranslations();
    let icon = null;
    let tooltip = null;
    if (type === "audio") {
        icon = <AudiotrackIcon />;
        tooltip = translations.AUDIO;
    }
    else if (type === "video") {
        icon = <MovieIcon />
        tooltip = translations.VIDEO;
    }
    const url = `player?prefix=sessions&group=${group}&year=${year}&name=${date + " " + name}&suffix=${suffix}`;
    return <IconButton onClick={() => addPath(url)}>
        <Tooltip arrow title={tooltip}>
            {icon}
        </Tooltip>
    </IconButton>
}

export default function Session({ group, name, audio, video, ...props }) {
    const isPhone = useDeviceType() === "phone";
    const groupName = group[0].toUpperCase() + group.slice(1);
    const audioItem = audio && <SessionItem name={name} group={group} {...props} type="audio" suffix=".m4a" />;
    const videoItem = video = <SessionItem name={name} group={group} {...props} type="video" suffix=".mp4" />;

    return <div className={clsx(styles.root, isPhone && styles.mobile)}>
        <div className={styles.group} dir="auto">
            {groupName}
        </div>
        <div className={styles.container}>
            <Tooltip arrow title={name}>
                <div className={styles.name} dir="auto">
                    {name}
                </div>
            </Tooltip>
        </div>
        <div className={styles.media}>
            {audioItem}
            {videoItem}
        </div>
    </div>;
}