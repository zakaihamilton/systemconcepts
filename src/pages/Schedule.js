import { useMemo, useEffect } from "react";
import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";
import WeekView from "./Schedule/WeekView";
import { Store } from "pullstate";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import DateRangeIcon from '@material-ui/icons/DateRange';
import ViewWeekIcon from '@material-ui/icons/ViewWeek';
import { useSearch } from "@/components/Search";
import Message from "@/widgets/Message";
import DataUsageIcon from '@material-ui/icons/DataUsage';
import { useLocalStorage } from "@/util/store";
import StatusBar from "@/widgets/StatusBar";
import Cookies from 'js-cookie';

export const ScheduleStore = new Store({
    date: null,
    viewMode: "week"
});

registerToolbar("Schedule");

export default function SchedulePage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    const [syncCounter] = useSync();
    let [sessions, loading] = useSessions([syncCounter]);
    const search = useSearch();
    let { date, viewMode } = ScheduleStore.useState();
    if (!date) {
        date = new Date();
    }
    useLocalStorage("ScheduleStore", ScheduleStore, ["viewMode"]);

    const toolbarItems = [
        {
            id: "month",
            name: translations.MONTH_VIEW,
            selected: viewMode,
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
            selected: viewMode,
            icon: <ViewWeekIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "week";
                });
            },
            divider: true
        }
    ].filter(Boolean);

    useToolbar({ id: "Schedule", items: toolbarItems, depends: [translations, viewMode] });

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
            s.mode = !isSignedIn ? "signin" : "";
            s.message = !isSignedIn ? translations.REQUIRE_SIGNIN : "";
        });
    }, [isSignedIn, translations]);

    return <div className={styles.root}>
        {statusBar}
        {viewMode === "month" && <MonthView sessions={items} date={date} store={ScheduleStore} />}
        {viewMode === "week" && <WeekView sessions={items} date={date} store={ScheduleStore} />}
        {loading && loadingElement}
    </div>;
}
