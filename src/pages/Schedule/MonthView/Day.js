import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth, getDateString } from "@/util/date";
import Avatar from '@material-ui/core/Avatar';
import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';

export default function Day({ sessions, month, column, row, date, dateFormatter }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    const sessionDate = getDateString(date);
    const elements = sessions.filter(session => session.date === sessionDate).map(session => {
        return <div className={styles.session}>
            <IconButton>
                <Tooltip arrow title={session.name}>
                    <VideoLabelIcon />
                </Tooltip>
            </IconButton>
        </div>;
    });
    return <div className={styles.root} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)}>
                {dayNumber}
            </Avatar>
        </div>
        <div className={styles.sessions}>
            {elements}
        </div>
    </div>
}