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

registerToolbar("DayView");

export default function DayView({ sessions, date, store }) {
    const direction = useDirection();
    const translations = useTranslations();
    const dayFormatter = useDateFormatter({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const title = dayFormatter.format(date);
    const sessionDate = getDateString(date);

    const { lastViewMode } = store.useState();

    const daySessions = sessions.filter(s => s.date === sessionDate);
    const items = daySessions.map(session => <Session key={session.name} {...session} />);

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

    const toolbarItems = [
        lastViewMode && {
            id: "back",
            name: translations.BACK,
            icon: direction === "rtl" ? <ArrowForwardIcon /> : <ArrowBackIcon />,
            onClick: goBack,
            location: "header"
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
        <div className={styles.title}>{title}</div>
        <div className={styles.list}>
            {items.length ? items : <div className={styles.empty}>{translations.NO_SESSIONS || "No sessions"}</div>}
        </div>
    </div>;
}
