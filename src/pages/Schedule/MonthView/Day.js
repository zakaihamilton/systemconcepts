import clsx from "clsx";
import styles from "./Day.module.scss";
import { isDateToday, isDateMonth, getDateString } from "@util/date";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@widgets/Menu";
import { addPath, toPath } from "@util/pages";
import SessionIcon from "@widgets/SessionIcon";

import { getSessionTextColor } from "@util/colors";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslations } from "@util/translations";

export default function Day({ sessions, month, column, row, date, columnCount, rowCount, dateFormatter, store }) {
    const translations = useTranslations();
    const theme = useTheme();
    const style = {
        gridColumn: column,
        gridRow: row
    };
    const onDayClick = () => {
        store.update(s => {
            s.date = date;
            s.viewMode = "day";
            s.lastViewMode = "month";
        });
    };
    const dayNumber = dateFormatter.format(date);
    const isToday = isDateToday(date);
    const isMonth = isDateMonth(date, month);
    const sessionDate = getDateString(date);
    const sessionItems = (sessions || []).filter(session => session.date === sessionDate);
    const items = sessionItems.map(item => {
        const groupName = item.group && (item.group[0].toUpperCase() + item.group.slice(1));
        const path = `session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
        const icon = <SessionIcon type={item.type} />;
        return {
            id: item.name,
            name: item.name,
            date: item.date,
            description: groupName,
            backgroundColor: item.color,
            style: { color: getSessionTextColor(item.color, theme) },
            icon,
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
            <Tooltip arrow title={translations.DAY_VIEW}>
                <Avatar className={clsx(styles.day, isToday && styles.today, isMonth && styles.active)} onClick={onDayClick} style={{ cursor: "pointer" }}>
                    {dayNumber}
                </Avatar>
            </Tooltip>
        </div>
        <div className={styles.sessions}>
            {!!items.length && <div className={styles.container}>
                <div className={styles.indicators}>
                    {items.slice(0, 12).map((item, index) => <Tooltip arrow title={<div style={{ textAlign: "center" }}>
                        {item.description && <div style={{ fontWeight: "bold" }}>{item.description}</div>}
                        <div>{item.name}</div>
                    </div>} key={index}>
                        <div className={styles.dot} style={{ backgroundColor: item.backgroundColor }} onClick={item.onClick} />
                    </Tooltip>)}
                </div>
                <Menu items={items}>
                    <Tooltip arrow title={translations.SESSIONS}>
                        <div className={styles.button}>
                            <ExpandMoreIcon className={styles.icon} />
                        </div>
                    </Tooltip>
                </Menu>
            </div>}
        </div>
    </div>;
}