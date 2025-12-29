import { useTranslations } from "@util/translations";
import styles from "./WeekView.module.scss";
import Week from "./WeekView/Week";
import DayHeader from "./WeekView/DayHeader";
import { getWeekViewStart, getMonthViewStart, addDate, getNumberOfWeeksInMonth, setWeekOfMonth, getMonthNames, getWeekOfMonth, getYearNames } from "@util/date";
import { useDateFormatter } from "@util/locale";
import Input from "@widgets/Input";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useDirection } from "@util/direction";
import { useDeviceType } from "@util/styles";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import clsx from "clsx";
import { useSwipe } from "@util/touch";
import SwipeIndicator from "@widgets/SwipeIndicator";

registerToolbar("WeekView");

export default function WeekView({ sessions, date, store }) {
    const { lastViewMode } = store.useState();
    const isPhone = useDeviceType() === "phone";
    const direction = useDirection();
    const translations = useTranslations();
    const firstDay = getWeekViewStart(date);
    const monthStart = getMonthViewStart(date);
    // Use the middle of the current week (Wednesday) to determine which month we're in
    // This ensures that weeks spanning two months are assigned to the month with more days
    const month = addDate(firstDay, 3);
    const dayHeaderFormatter = useDateFormatter({
        weekday: "short"
    });
    const dayFormatter = useDateFormatter({
        day: "numeric"
    });
    const dateFormatter = useDateFormatter({
        day: "numeric",
        month: "short"
    });
    const monthFormatter = useDateFormatter({
        month: isPhone ? "short" : "long"
    });
    const yearFormatter = useDateFormatter({
        year: "numeric"
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        return <DayHeader key={index} date={day} index={index} count={numDaysInWeek} dateFormatter={dateFormatter} dayFormatter={dayHeaderFormatter} store={store} />;
    });

    // Calculate week number based on the month (middle of week), not the original date
    // This ensures weeks spanning months show the correct week number for the displayed month
    const weekOfMonth = getWeekOfMonth(month);
    const numOfWeeksInMonth = getNumberOfWeeksInMonth(month);
    const weekState = [weekOfMonth + 1, week => {
        const newDate = new Date(month);
        setWeekOfMonth(newDate, week - 1);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const weekItems = new Array(numOfWeeksInMonth || 0).fill(0).map((_, index) => {
        return {
            id: index + 1,
            name: index + 1
        };
    });

    const weekWidget = <Input select={true} label={translations.WEEK} helperText="" fullWidth={false} items={weekItems} state={weekState} />;

    const monthState = [month.getMonth() + 1, newMonth => {
        const newDate = new Date(date);
        newDate.setMonth(newMonth - 1);
        newDate.setDate(1);
        // Get the first day of the first week of this month (Sunday before or on the 1st)
        const firstWeekStart = getMonthViewStart(newDate);
        store.update(s => {
            s.date = firstWeekStart;
        });
    }];
    const monthItems = getMonthNames(month, monthFormatter).map((name, index) => {
        return {
            id: index + 1,
            name
        };
    });
    const monthWidget = <Input select={true} label={translations.MONTH} helperText="" fullWidth={false} items={monthItems} state={monthState} />;

    const yearState = [month.getFullYear(), year => {
        const newDate = new Date(date);
        newDate.setFullYear(year);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const currentYear = month.getFullYear();
    const yearStart = 2015;
    let yearEnd = new Date().getFullYear() + 2;
    if (yearEnd < yearStart) {
        yearEnd = yearStart + 1;
    }
    if (currentYear > yearEnd) {
        yearEnd = currentYear;
    }
    const yearItems = getYearNames(month, yearFormatter, yearStart, yearEnd).map((name, index) => {
        return {
            id: yearStart + index,
            name
        };
    });
    const yearWidget = <Input select={true} label={translations.YEAR} helperText="" fullWidth={false} items={yearItems} state={yearState} />;

    const gotoPreviousWeek = () => {
        const newDate = new Date(firstDay);
        setWeekOfMonth(newDate, getWeekOfMonth(newDate) - 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const gotoNextWeek = () => {
        const newDate = new Date(firstDay);
        setWeekOfMonth(newDate, getWeekOfMonth(newDate) + 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const today = new Date();
    const hasPreviousWeek = weekOfMonth || month.getFullYear() !== yearStart;
    const hasNextWeek = weekOfMonth !== (numOfWeeksInMonth - 1) || month.getFullYear() !== yearEnd;
    const isToday = weekOfMonth === getWeekOfMonth(today) && month.getMonth() == today.getMonth() && month.getFullYear() == today.getFullYear();

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
            location: "header",
            disabled: isToday,
            divider: true
        },
        {
            id: "previousWeek",
            name: translations.PREVIOUS_WEEK,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousWeek,
            disabled: !hasPreviousWeek,
            location: "footer"
        },
        {
            id: "weekWidget",
            element: weekWidget,
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
            id: "nextWeek",
            divider: true,
            name: translations.NEXT_WEEK,
            icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            onClick: gotoNextWeek,
            disabled: !hasNextWeek,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "WeekView", items: toolbarItems, depends: [translations, month, lastViewMode] });

    return <div className={styles.root}>
        <div className={clsx(styles.grid, isPhone && styles.mobile)}>
            {dayTitles}
            <Week sessions={sessions} month={month} date={firstDay} row={2} dateFormatter={dayFormatter} />
        </div>
    </div>;
}
