import { useTranslations } from "@util/translations";
import styles from "./YearView.module.scss";
import Month from "./YearView/Month";
import { getYearNames } from "@util/date";
import { useDateFormatter } from "@util/locale";
import Input from "@widgets/Input";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useDirection } from "@util/direction";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useSwipe } from "@util/touch";

registerToolbar("YearView");

export default function YearView({ sessions, date, store }) {
    const { lastViewMode } = store.useState();
    const direction = useDirection();
    const translations = useTranslations();
    const yearFormatter = useDateFormatter({ year: "numeric" });

    const currentYear = date.getFullYear();

    const months = new Array(12).fill(0).map((_, index) => {
        const monthDate = new Date(currentYear, index, 1);
        return <Month key={index} date={monthDate} sessions={sessions} store={store} />;
    });

    const yearState = [currentYear, year => {
        const newDate = new Date(date);
        newDate.setFullYear(year);
        store.update(s => {
            s.date = newDate;
        });
    }];
    const yearStart = 2015;
    const yearEnd = new Date().getFullYear() + 2;
    const yearItems = getYearNames(new Date(currentYear, 0, 1), yearFormatter, yearStart, yearEnd).map((name, index) => ({
        id: yearStart + index,
        name
    }));
    const yearWidget = <Input select={true} label={translations.YEAR} helperText="" fullWidth={false} style={{ minWidth: "5em" }} items={yearItems} state={yearState} />;

    const gotoPreviousYear = () => {
        const newDate = new Date(date);
        newDate.setFullYear(currentYear - 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const gotoNextYear = () => {
        const newDate = new Date(date);
        newDate.setFullYear(currentYear + 1);
        store.update(s => {
            s.date = newDate;
        });
    };

    const gotoToday = () => {
        store.update(s => {
            s.date = new Date();
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
            menu: false
        },
        {
            id: "previousYear",
            name: translations.PREVIOUS_YEAR,
            icon: direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: gotoPreviousYear,
            location: "footer"
        },
        {
            id: "yearWidget",
            element: yearWidget,
            location: "footer"
        },
        {
            id: "nextYear",
            name: translations.NEXT_YEAR,
            icon: direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            onClick: gotoNextYear,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "YearView", items: toolbarItems, depends: [translations, currentYear, lastViewMode] });

    const { swipeDirection, ...swipeHandlers } = useSwipe({
        onSwipeLeft: direction === "rtl" ? gotoPreviousYear : gotoNextYear,
        onSwipeRight: direction === "rtl" ? gotoNextYear : gotoPreviousYear
    });

    return <div className={styles.root} {...swipeHandlers}>
        {months}
    </div>;
}
