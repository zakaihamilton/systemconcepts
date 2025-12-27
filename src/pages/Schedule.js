import { useMemo, useEffect } from "react";
import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";
import WeekView from "./Schedule/WeekView";
import { Store } from "pullstate";
import { useSessions, SessionsStore } from "@util/sessions";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import YearView from "./Schedule/YearView";
import DayView from "./Schedule/DayView";
import { useSearch } from "@components/Search";
import Message from "@widgets/Message";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import { useLocalStorage } from "@util/store";
import StatusBar from "@widgets/StatusBar";
import Cookies from "js-cookie";
import FilterBar from "@pages/Sessions/FilterBar";
import { useDeviceType } from "@util/styles";

export const ScheduleStore = new Store({
    date: null,
    viewMode: "week"
});

registerToolbar("Schedule");

export default function SchedulePage() {
    const isMobile = useDeviceType() === "phone";
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    let [sessions, loading] = useSessions();
    const search = useSearch("schedule");
    let { date, viewMode } = ScheduleStore.useState();
    const { showFilterDialog } = SessionsStore.useState();
    if (!date) {
        date = new Date();
    }
    useLocalStorage("ScheduleStore", ScheduleStore, ["viewMode"]);

    const viewOptions = [
        {
            id: "year",
            name: translations.YEAR_VIEW,
            icon: <CalendarViewMonthIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "year";
                });
            }
        },
        {
            id: "month",
            name: translations.MONTH_VIEW,
            icon: <DateRangeIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "month";
                });
            }
        },
        {
            id: "week",
            name: translations.WEEK_VIEW,
            icon: <ViewWeekIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "week";
                });
            }
        },
        {
            id: "day",
            name: translations.DAY_VIEW,
            icon: <CalendarViewDayIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "day";
                });
            }
        }
    ];

    const toolbarItems = [];
    if (!isMobile) {
        toolbarItems.push(...viewOptions.map(item => ({
            ...item,
            selected: viewMode,
            location: "header",
            menu: false
        })));
    }

    useToolbar({ id: "Schedule", items: toolbarItems, depends: [translations, viewMode, isMobile] });

    const items = useMemo(() => {
        let items = sessions;
        if (search) {
            items = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
        }
        return items;
    }, [search, sessions]);

    const loadingElement = <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />;

    const statusBar = <StatusBar store={ScheduleStore} />;

    useEffect(() => {
        ScheduleStore.update(s => {
            if (!isSignedIn) {
                s.mode = "signin";
                s.message = translations.REQUIRE_SIGNIN;
            }

            else {
                s.mode = "";
                s.message = "";
            }
        });
    }, [isSignedIn, translations]);

    return <div className={styles.root}>
        {statusBar}
        {!!showFilterDialog && !isMobile && <FilterBar hideYears={true} />}
        {!loading && viewMode === "year" && <YearView sessions={items} date={date} store={ScheduleStore} />}
        {!loading && viewMode === "month" && <MonthView sessions={items} date={date} store={ScheduleStore} />}
        {!loading && viewMode === "week" && <WeekView sessions={items} date={date} store={ScheduleStore} />}
        {!loading && viewMode === "day" && <DayView sessions={items} date={date} store={ScheduleStore} />}
        {!!loading && loadingElement}
        {!!showFilterDialog && !!isMobile && <FilterBar hideYears={true} />}
    </div>;
}
