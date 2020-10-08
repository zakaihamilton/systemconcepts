import { useTranslations } from "@/util/translations";
import styles from "./WeekView.module.scss";
import Week from "./WeekView/Week";
import DayHeader from "./WeekView/DayHeader";
import { getWeekViewStart, getMonthViewStart, addDate, getNumberOfWeeksInMonth, setWeekOfMonth, getMonthNames, getWeekOfMonth, getYearNames } from "@/util/date";
import { useDateFormatter } from "@/util/locale";
import Input from "@/widgets/Input";
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import TodayIcon from '@material-ui/icons/Today';
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { useDirection } from "@/util/direction";
import { useDeviceType } from "@/util/styles";
import clsx from "clsx";

registerToolbar("WeekView");

export default function WeekView({ sessions, date, store }) {
    const isPhone = useDeviceType() === "phone";
    const direction = useDirection();
    const translations = useTranslations();
    const firstDay = getWeekViewStart(date);
    const monthStart = getMonthViewStart(date);
    const month = addDate(monthStart, 14);
    const dayHeaderFormatter = useDateFormatter({
        weekday: 'short'
    });
    const dayFormatter = useDateFormatter({
        day: 'numeric'
    });
    const dateFormatter = useDateFormatter({
        day: 'numeric',
        month: "short"
    });
    const monthFormatter = useDateFormatter({
        month: isPhone ? "numeric" : "long"
    }, [isPhone]);
    const yearFormatter = useDateFormatter({
        year: "numeric"
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        return <DayHeader key={index} date={day} index={index} dateFormatter={dateFormatter} dayFormatter={dayHeaderFormatter} />
    });

    const weekOfMonth = getWeekOfMonth(firstDay);
    const numOfWeeksInMonth = getNumberOfWeeksInMonth(month);
    const weekState = [weekOfMonth + 1, week => {
        const newDate = new Date(date);
        setWeekOfMonth(newDate, week - 1);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const weekItems = new Array(numOfWeeksInMonth).fill(0).map((_, index) => {
        return {
            id: index + 1,
            name: index + 1
        };
    });

    const weekWidget = <Input select={true} label={translations.WEEK} variant="standard" helperText="" fullWidth={false} style={{ minWidth: "3em" }} items={weekItems} state={weekState} />;

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
    const monthWidget = <Input select={true} label={translations.MONTH} variant="standard" helperText="" fullWidth={false} style={{ minWidth: isPhone ? "3.7em" : "10em" }} items={monthItems} state={monthState} />;

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
    const yearWidget = <Input select={true} label={translations.YEAR} variant="standard" helperText="" fullWidth={false} style={{ minWidth: "5em" }} items={yearItems} state={yearState} />;

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
    const isToday = weekOfMonth === getWeekOfMonth(today) && month.getMonth() == today.getMonth() && month.getFullYear() == today.getFullYear()

    const gotoToday = () => {
        store.update(s => {
            s.date = today;
        });
    };

    const menuItems = [
        {
            id: "today",
            name: translations.TODAY,
            icon: <TodayIcon />,
            onClick: gotoToday,
            disabled: isToday,
            divider: true
        },
        {
            id: "previousWeek",
            name: translations.PREVIOUS_WEEK,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousWeek,
            disabled: !hasPreviousWeek,
            divider: true,
            location: "footer"
        },
        {
            id: "weekWidget",
            divider: true,
            element: weekWidget,
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
            divider: true,
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

    useToolbar({ id: "WeekView", items: menuItems, depends: [translations, month] });

    return <div className={styles.root}>
        <div className={clsx(styles.grid, isPhone && styles.mobile)}>
            {dayTitles}
            <Week sessions={sessions} month={month} date={firstDay} row={2} dateFormatter={dayFormatter} />
        </div>
    </div>
}
