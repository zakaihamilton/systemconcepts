import { useTranslations } from "@util/translations";
import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth, getDateString } from "@util/date";
import Avatar from "@mui/material/Avatar";
import VideoLabelIcon from "@mui/icons-material/VideoLabel";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@widgets/Menu";
import { addPath, toPath } from "@util/pages";

import { getSessionTextColor } from "@util/colors";
import { useTheme } from "@mui/material/styles";

export default function Day({ sessions, month, column, row, date, columnCount, rowCount, dateFormatter }) {
    const theme = useTheme();
    const style = {
        gridColumn: column,
        gridRow: row
    };
    const translations = useTranslations();
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    const sessionDate = getDateString(date);
    const sessionItems = (sessions || []).filter(session => session.date === sessionDate);
    const items = sessionItems.filter(item => item.audio || item.video).map(item => {
        const groupName = item.group && (item.group[0].toUpperCase() + item.group.slice(1));
        const path = `session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
        return {
            id: item.name,
            name: item.name,
            date: item.date,
            backgroundColor: item.color,
            style: { color: getSessionTextColor(item.color, theme) },
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
                <div className={styles.indicators}>
                    {items.slice(0, 12).map((item, index) => <Tooltip arrow title={<div style={{ textAlign: "center" }}>
                        {item.description && <div style={{ fontWeight: "bold" }}>{item.description}</div>}
                        <div>{item.name}</div>
                    </div>} key={index}>
                        <div className={styles.dot} style={{ backgroundColor: item.backgroundColor }} />
                    </Tooltip>)}
                </div>
            </Menu>}
        </div>
    </div>;
}