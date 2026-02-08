import { useState } from "react";
import { useTranslations } from "@util/translations";
import styles from "./MonthView.module.scss";
import Week from "./MonthView/Week";
import DayHeader from "./MonthView/DayHeader";
import { getMonthViewStart, addDate, getMonthNames, getYearNames, getDateString, getNumberOfWeeksInMonth } from "@util/date";
import { useDateFormatter } from "@util/locale";
import Input from "@widgets/Input";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useDirection } from "@util/direction";
import { useDeviceType } from "@util/styles";
import { useSwipe } from "@util/touch";
import Sessions from "./MonthView/Sessions";
import { addPath, toPath } from "@util/pages";
import SessionIcon from "@widgets/SessionIcon";
import { getSessionTextColor } from "@util/colors";
import { useTheme } from "@mui/material/styles";

registerToolbar("MonthView");

export default function MonthView({ sessions, date, store, playingSession }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [popupDate, setPopupDate] = useState(null);
    const isPhone = useDeviceType() === "phone";
    const direction = useDirection();
    const { lastViewMode } = store.useState();
    const translations = useTranslations();
    const theme = useTheme();
    const firstDay = getMonthViewStart(date);
    const dayHeaderFormatter = useDateFormatter({
        weekday: isPhone ? "narrow" : "short"
    });
    const dayFormatter = useDateFormatter({
        day: "numeric"
    });
    const monthFormatter = useDateFormatter({
        month: isPhone ? "short" : "long"
    });
    const yearFormatter = useDateFormatter({
        year: "numeric"
    });

    // Get the first day of the month from the date prop
    const month = new Date(date);
    month.setDate(1);

    const numWeeks = getNumberOfWeeksInMonth(month);
    const weeks = new Array(numWeeks).fill(0).map((_, index) => {
        const weekFirstDay = addDate(firstDay, index * 7);
        return <Week sessions={sessions} key={index} month={month} date={weekFirstDay} row={index + 2} rowCount={numWeeks + 1} dateFormatter={dayFormatter} store={store} onMenuVisible={setIsMenuOpen} onOpenDay={setPopupDate} playingSession={playingSession} />;
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        return <DayHeader key={index} date={day} index={index} count={numDaysInWeek} dateFormatter={dayHeaderFormatter} />;
    });

    const monthState = [month.getMonth() + 1, month => {
        const newDate = new Date(date);
        newDate.setMonth(month - 1);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const monthItems = getMonthNames(month, monthFormatter).map((name, index) => {
        return {
            id: index + 1,
            name
        };
    });
    const monthWidget = <Input background={false} select={true} label={translations.MONTH} helperText="" fullWidth={false} style={{ minWidth: isPhone ? "3.7em" : "10em" }} items={monthItems} state={monthState} />;

    const yearState = [month.getFullYear(), year => {
        const newDate = new Date(date);
        newDate.setFullYear(year);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const yearStart = 2015;
    const yearEnd = new Date().getFullYear() + 2;
    const yearItems = getYearNames(month, yearFormatter, yearStart, yearEnd).map((name, index) => {
        return {
            id: yearStart + index,
            name
        };
    });
    const yearWidget = <Input background={false} select={true} label={translations.YEAR} helperText="" fullWidth={false} style={{ minWidth: "5em" }} items={yearItems} state={yearState} />;

    const gotoPreviousMonth = () => {
        const newDate = new Date(month);
        newDate.setMonth(newDate.getMonth() - 1);
        // Don't go before January of yearStart
        if (newDate.getFullYear() < yearStart || (newDate.getFullYear() === yearStart && newDate.getMonth() < 0)) {
            return;
        }
        store.update(s => {
            s.date = newDate;
        });
    };

    const gotoNextMonth = () => {
        const newDate = new Date(month);
        newDate.setMonth(newDate.getMonth() + 1);
        // Don't go after December of yearEnd
        if (newDate.getFullYear() > yearEnd || (newDate.getFullYear() === yearEnd && newDate.getMonth() > 11)) {
            return;
        }
        store.update(s => {
            s.date = newDate;
        });
    };

    const today = new Date();
    const hasPreviousMonth = month.getMonth() || month.getFullYear() !== yearStart;
    const hasNextMonth = month.getMonth() !== 11 || month.getFullYear() !== yearEnd;
    const isToday = month.getMonth() == today.getMonth() && month.getFullYear() == today.getFullYear();

    const gotoToday = () => {
        store.update(s => {
            s.date = today;
        });
    };

    const goBack = () => {
        if (lastViewMode) {
            store.update(s => {
                s.viewMode = lastViewMode;
                s.lastViewMode = null;
            });
        }
    };

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
            disabled: isToday,
            location: "header",
            menu: false
        },
        {
            id: "previousMonth",
            name: translations.PREVIOUS_MONTH,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousMonth,
            disabled: !hasPreviousMonth,
            location: "footer"
        },
        {
            id: "monthWidget",
            divider: true,
            element: monthWidget,
            location: "footer"
        },
        {
            id: "yearWidget",
            element: yearWidget,
            location: "footer"
        },
        {
            id: "nextMonth",
            name: translations.NEXT_MONTH,
            icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            onClick: gotoNextMonth,
            disabled: !hasNextMonth,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "MonthView", items: toolbarItems, depends: [translations, month, lastViewMode] });

    const swipeHandlers = useSwipe({
        onSwipeLeft: direction === "rtl" ? gotoPreviousMonth : gotoNextMonth,
        onSwipeRight: direction === "rtl" ? gotoNextMonth : gotoPreviousMonth
    });

    const gotoPreviousDay = () => {
        setPopupDate(addDate(popupDate, -1));
    };

    const gotoNextDay = () => {
        setPopupDate(addDate(popupDate, 1));
    };

    const sessionDate = popupDate && getDateString(popupDate);
    const sessionItems = (sessions || []).filter(session => session.date === sessionDate);
    const popupItems = sessionItems.map(item => {
        const groupName = item.group && (item.group[0].toUpperCase() + item.group.slice(1));
        const path = `session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
        const icon = <SessionIcon type={item.type} />;
        return {
            id: item.name,
            name: item.name,
            group: item.group,
            date: item.date,
            type: item.type,
            description: groupName,
            backgroundColor: item.color,
            style: { color: getSessionTextColor(item.color, theme) },
            icon,
            target: "#schedule/" + toPath(path),
            onClick: () => addPath(path)
        };
    });

    return <div className={styles.root} {...(!isMenuOpen && !popupDate && swipeHandlers)}>
        <div className={styles.grid} style={{ gridTemplateRows: `3em repeat(${numWeeks}, 1fr)` }}>
            {dayTitles}
            {weeks}
        </div>
        <Sessions
            open={!!popupDate}
            onClose={() => setPopupDate(null)}
            date={popupDate}
            items={popupItems}
            onSwipeLeft={direction === "rtl" ? gotoPreviousDay : gotoNextDay}
            onSwipeRight={direction === "rtl" ? gotoNextDay : gotoPreviousDay}
            direction={direction}
            playingSession={playingSession} />
    </div>;
}
