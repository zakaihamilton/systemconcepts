import { useTranslations } from "@/util/translations";
import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth, getDateString } from "@/util/date";
import Avatar from '@material-ui/core/Avatar';
import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Menu from "@/widgets/Menu";
import { addPath } from "@/util/pages";
import MovieIcon from '@material-ui/icons/Movie';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';

export default function Day({ sessions, month, column, row, date, dateFormatter }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const translations = useTranslations();
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    const sessionDate = getDateString(date);
    const sessionItems = sessions.filter(session => session.date === sessionDate).map(item => {
        const media = [];
        const groupName = item.group[0].toUpperCase() + item.group.slice(1);
        if (item.audio) {
            media.push({
                id: "audio" + item.name,
                name: item.name,
                icon: <Tooltip title={translations.AUDIO}><AudiotrackIcon /></Tooltip>,
                description: groupName,
                onClick: () => addPath(`player?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.date + " " + item.name}&suffix=.m4a`)
            });
        }
        if (item.video) {
            media.push({
                id: "video" + item.name,
                name: item.name,
                icon: <Tooltip title={translations.VIDEO}><MovieIcon /></Tooltip>,
                description: groupName,
                onClick: () => addPath(`player?prefix=sessions&group=${item.group}&year=${item.year}&name=${item.date + " " + item.name}&suffix=.mp4`)
            });
        }
        if (media.length) {
            media[media.length - 1].divider = true;
        }
        return media;
    }).flat();
    return <div className={styles.root} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)}>
                {dayNumber}
            </Avatar>
        </div>
        <div className={styles.sessions}>
            {sessionItems.length && <Menu items={sessionItems}>
                <IconButton>
                    <Tooltip arrow title={translations.SESSIONS}>
                        <VideoLabelIcon />
                    </Tooltip>
                </IconButton>
            </Menu>}
        </div>
    </div>
}