import { useTranslations } from "@/util/translations";
import styles from "./MonthView.module.scss";
import Week from "./MonthView/Week";
import DayHeader from "./MonthView/DayHeader";
import { getMonthViewStart, addDate, getMonthNames, getYearNames } from "@/util/date";
import { useDateFormatter } from "@/util/locale";
import Input from "@/widgets/Input";
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import TodayIcon from '@material-ui/icons/Today';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

registerToolbar("MonthView");

export default function MonthView({ sessions, date, store }) {
    const translations = useTranslations();
    const firstDay = getMonthViewStart(date);
    const dayHeaderFormatter = useDateFormatter({
        weekday: 'short'
    });
    const dayFormatter = useDateFormatter({
        day: 'numeric'
    });
    const monthFormatter = useDateFormatter({
        month: "long"
    });
    const yearFormatter = useDateFormatter({
        year: "numeric"
    });

    const month = addDate(firstDay, 15);

    const numWeeks = 6;
    const weeks = new Array(numWeeks).fill(0).map((_, index) => {
        const weekFirstDay = addDate(firstDay, index * 7);
        return <Week sessions={sessions} key={index} month={month} date={weekFirstDay} row={index + 2} dateFormatter={dayFormatter} />;
    });

    const numDaysInWeek = 7;
    const dayTitles = new Array(numDaysInWeek).fill(0).map((_, index) => {
        const day = addDate(firstDay, index);
        return <DayHeader key={index} date={day} index={index} dateFormatter={dayHeaderFormatter} />
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
    const monthWidget = <Input select={true} variant="standard" helperText="" fullWidth={false} className={styles.input} style={{ minWidth: "12em" }} items={monthItems} state={monthState} />;

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
    const yearWidget = <Input select={true} variant="standard" helperText="" fullWidth={false} className={styles.input} style={{ minWidth: "8em" }} items={yearItems} state={yearState} />;

    const gotoPreviousMonth = () => {
        const newDate = new Date(month);
        newDate.setMonth(newDate.getMonth() - 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const gotoNextMonth = () => {
        const newDate = new Date(month);
        newDate.setMonth(newDate.getMonth() + 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const today = new Date();
    const hasPreviousMonth = month.getMonth() || month.getFullYear() !== yearStart;
    const hasNextMonth = month.getMonth() !== 11 || month.getFullYear() !== yearEnd;
    const isToday = month.getMonth() == today.getMonth() && month.getFullYear() == today.getFullYear()

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
            divider: true,
            location: "footer"
        },
        {
            id: "previousMonth",
            name: translations.PREVIOUS_MONTH,
            icon: <ChevronLeftIcon />,
            onClick: gotoPreviousMonth,
            disabled: !hasPreviousMonth,
            divider: true,
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
            id: "nextMonth",
            divider: true,
            name: translations.NEXT_MONTH,
            icon: <ChevronRightIcon />,
            onClick: gotoNextMonth,
            disabled: !hasNextMonth,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "MonthView", items: menuItems, depends: [translations, month] });

    return <div className={styles.root}>
        <div className={styles.grid}>
            {dayTitles}
            {weeks}
        </div>
    </div>
}
