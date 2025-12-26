import { useTranslations } from "@util/translations";
import styles from "./DayView.module.scss";
import Session from "./WeekView/Session";
import { addDate, getDateString, getDaysInMonth, getMonthNames, getYearNames } from "@util/date";
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
import Input from "@components/Widgets/Input";

registerToolbar("DayView");

export default function DayView({ sessions, date, store }) {
    const theme = useTheme();
    const isPhone = useDeviceType() === "phone";
    const direction = useDirection();
    const translations = useTranslations();

    const weekdayFormatter = useDateFormatter({ weekday: "long" });
    const monthFormatter = useDateFormatter({
        month: isPhone ? "short" : "long"
    });
    const yearFormatter = useDateFormatter({ year: "numeric" });

    const weekday = weekdayFormatter.format(date);
    const monthDay = monthFormatter.format(date);
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
                    .sort((a, b) => (a.typeOrder || 0) - (b.typeOrder || 0))
                    .map(session => {
                        const { name, ...props } = session;
                        return <Session key={name} name={name} {...props} showGroup={false} />;
                    })}
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

    const daysInMonth = getDaysInMonth(date);
    const dayItems = new Array(daysInMonth).fill(0).map((_, index) => {
        return {
            id: index + 1,
            name: index + 1
        };
    });

    const dayState = [date.getDate(), day => {
        const newDate = new Date(date);
        newDate.setDate(day);
        store.update(s => { s.date = newDate; });
    }];

    const dayWidget = <Input select={true} label={translations.DAY} helperText="" fullWidth={false} style={{ minWidth: "4em" }} items={dayItems} state={dayState} />;

    const monthState = [date.getMonth() + 1, month => {
        const newDate = new Date(date);
        newDate.setDate(1); // Start at the beginning of the month to avoid overflow issues (e.g. going from Jan 31 to Feb)
        newDate.setMonth(month - 1);
        const daysInNewMonth = getDaysInMonth(newDate);
        if (date.getDate() > daysInNewMonth) {
            newDate.setDate(daysInNewMonth);
        } else {
            newDate.setDate(date.getDate());
        }
        store.update(s => {
            s.date = newDate;
        });
    }];
    const monthItems = getMonthNames(date, monthFormatter).map((name, index) => {
        return {
            id: index + 1,
            name
        };
    });
    const monthWidget = <Input select={true} label={translations.MONTH} helperText="" fullWidth={false} items={monthItems} state={monthState} />;

    const yearState = [date.getFullYear(), year => {
        const newDate = new Date(date);
        newDate.setFullYear(year);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const currentYear = date.getFullYear();
    const yearStart = 2015;
    let yearEnd = new Date().getFullYear() + 2;
    if (yearEnd < yearStart) {
        yearEnd = yearStart + 1;
    }
    if (currentYear > yearEnd) {
        yearEnd = currentYear;
    }
    const yearItems = getYearNames(date, yearFormatter, yearStart, yearEnd).map((name, index) => {
        return {
            id: yearStart + index,
            name
        };
    });
    const yearWidget = <Input select={true} label={translations.YEAR} helperText="" fullWidth={false} style={{ minWidth: "5em" }} items={yearItems} state={yearState} />;

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
            id: "dayWidget",
            element: dayWidget,
            location: "footer"
        },
        {
            id: "monthWidget",
            element: monthWidget,
            location: "footer"
        },
        {
            id: "yearWidget",
            element: yearWidget,
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
