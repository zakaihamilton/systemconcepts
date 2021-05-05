import { useTranslations } from "@util/translations";
import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth, getDateString } from "@util/date";
import Avatar from '@material-ui/core/Avatar';
import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import Tooltip from '@material-ui/core/Tooltip';
import Menu from "@widgets/Menu";
import { addPath, toPath } from "@util/pages";
import { useDeviceType } from "@util/styles";
import HoverButton from "@widgets/HoverButton";

export default function Day({ sessions, month, column, row, date, columnCount, rowCount, dateFormatter }) {
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
    const sessionItems = (sessions || []).filter(session => session.date === sessionDate);
    const items = sessionItems.filter(item => item.audio || item.video).map(item => {
        const groupName = item.group[0].toUpperCase() + item.group.slice(1);
        const path = `session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
        return {
            id: item.name,
            name: item.name,
            backgroundColor: item.color,
            icon: <Tooltip title={translations.SESSION}><VideoLabelIcon /></Tooltip>,
            description: groupName,
            target: "#schedule/" + toPath(path),
            onClick: () => addPath(path)
        };
    });
    const className = clsx(
        styles.root,
        column === columnCount && styles.lastColumn,
        row === rowCount && styles.lastRow
    );
    return <div className={className} style={style}>
        <div className={styles.title}>
            <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)}>
                {dayNumber}
            </Avatar>
        </div>
        <div className={styles.sessions}>
            {!!items.length && <Menu hover={true} items={items}>
                <HoverButton size={48}>
                    <VideoLabelIcon fontSize="small" />
                </HoverButton>
            </Menu>}
        </div>
    </div>
}