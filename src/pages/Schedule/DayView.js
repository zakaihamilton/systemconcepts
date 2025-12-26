import { useTranslations } from "@util/translations";
import styles from "./DayView.module.scss";
import Session from "./WeekView/Session";
import { addDate, getDateString } from "@util/date";
import { useDateFormatter } from "@util/locale";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useDirection } from "@util/direction";
import { useDeviceType } from "@util/styles";
import { useTheme, getContrastRatio } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";

registerToolbar("DayView");

export default function DayView({ sessions, date, store }) {
    const theme = useTheme();
    const isPhone = useDeviceType() === "phone";
    const direction = useDirection();
    const translations = useTranslations();

    const weekdayFormatter = useDateFormatter({ weekday: "long" });
    const monthDayFormatter = useDateFormatter({ day: "numeric", month: "long" });
    const yearFormatter = useDateFormatter({ year: "numeric" });

    const weekday = weekdayFormatter.format(date);
    const monthDay = monthDayFormatter.format(date);
    const year = yearFormatter.format(date);

    const sessionDate = getDateString(date);
    const { lastViewMode } = store.useState();

    const daySessions = sessions.filter(s => s.date === sessionDate);

    // Group sessions
    const groups = daySessions.reduce((acc, session) => {
        const groupKey = session.group;
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(session);
        return acc;
    }, {});

    const sortedGroups = Object.keys(groups).sort();

    const items = sortedGroups.map(group => {
        const groupLabel = group[0].toUpperCase() + group.slice(1);
        const firstSession = groups[group][0];
        const groupColor = firstSession.color;
        let textColor = theme.palette.text.primary;
        if (groupColor) {
            const contrastWhite = getContrastRatio(groupColor, '#ffffff');
            const contrastBlack = getContrastRatio(groupColor, '#000000');
            textColor = contrastWhite >= contrastBlack ? '#ffffff' : '#000000';
        }
        return <div key={group} className={styles.group}>
            <div className={styles.groupTitle} style={{ backgroundColor: groupColor, color: textColor, padding: "0.5em", borderRadius: "8px" }}>
                {groupLabel}
            </div>
            <div className={styles.groupItems}>
                {groups[group]
                    .sort((a, b) => (a.typeOrder || 0) - (b.typeOrder || 0))
                    .map(session => <Session key={session.name} {...session} showGroup={false} />)}
            </div>
        </div>;
    });

    const gotoPreviousDay = () => {
        const newDate = addDate(date, -1);
        store.update(s => { s.date = newDate; });
    };

    const gotoNextDay = () => {
        const newDate = addDate(date, 1);
        store.update(s => { s.date = newDate; });
    };

    const gotoToday = () => {
        store.update(s => { s.date = new Date(); });
    };

    const goBack = () => {
        if (lastViewMode) {
            store.update(s => {
                s.viewMode = lastViewMode;
                s.lastViewMode = null;
            });
        }
    };

    const goWeek = () => store.update(s => { s.viewMode = "week"; s.lastViewMode = "day"; });
    const goMonth = () => store.update(s => { s.viewMode = "month"; s.lastViewMode = "day"; });
    const goYear = () => store.update(s => { s.viewMode = "year"; s.lastViewMode = "day"; });

    const toolbarItems = [
        {
            id: "back",
            name: translations.BACK,
            icon: direction === "rtl" ? <ArrowForwardIcon /> : <ArrowBackIcon />,
            onClick: goBack,
            location: "header",
            disabled: !lastViewMode
        },
        {
            id: "today",
            name: translations.TODAY,
            icon: <TodayIcon />,
            onClick: gotoToday,
            location: "header",
            divider: true
        },
        {
            id: "previousDay",
            name: translations.PREVIOUS_DAY,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousDay,
            location: "footer"
        },
        {
            id: "nextDay",
            name: translations.NEXT_DAY,
            icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            onClick: gotoNextDay,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "DayView", items: toolbarItems, depends: [translations, date, lastViewMode] });

    return <div className={styles.root}>
        <div className={styles.title}>
            <Tooltip title={translations.WEEK_VIEW}>
                <span onClick={goWeek} className={styles.link}>{weekday}</span>
            </Tooltip>
            <span className={styles.separator}>, </span>
            <Tooltip title={translations.MONTH_VIEW}>
                <span onClick={goMonth} className={styles.link}>{monthDay}</span>
            </Tooltip>
            <span className={styles.separator}>, </span>
            <Tooltip title={translations.YEAR_VIEW}>
                <span onClick={goYear} className={styles.link}>{year}</span>
            </Tooltip>
        </div>
        <div className={styles.list}>
            {items.length ? items : <div className={styles.empty}>{translations.NO_SESSIONS || "No sessions"}</div>}
        </div>
    </div>;
}
