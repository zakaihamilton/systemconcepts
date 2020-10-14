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
import { useDeviceType } from "@/util/styles";

export default function Day({ sessions, month, column, row, date, dateFormatter }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const isPhone = useDeviceType() === "phone";
    const translations = useTranslations();
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    const sessionDate = getDateString(date);
    const sessionItems = sessions.filter(session => session.date === sessionDate);
    const items = sessionItems.filter(item => item.audio || item.video).map(item => {
        const groupName = item.group[0].toUpperCase() + item.group.slice(1);
        return {
            id: item.name,
            name: item.name,
            backgroundColor: item.color,
            icon: <Tooltip title={translations.SESSION}><VideoLabelIcon /></Tooltip>,
            description: groupName,
            onClick: () => addPath(`session?prefix=sessions&group=${item.group}&year=${item.year}&date=${item.date}&name=${item.name}&color=${item.color}`)
        };
    });
    return <div className={styles.root} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)}>
                {dayNumber}
            </Avatar>
        </div>
        <div className={styles.sessions}>
            {!!items.length && <Menu items={items}>
                <IconButton>
                    <Tooltip arrow title={translations.SESSIONS}>
                        <VideoLabelIcon />
                    </Tooltip>
                </IconButton>
            </Menu>}
        </div>
    </div>
}