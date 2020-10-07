import { useMemo } from "react";
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
import { useSearch } from "@/components/AppBar/Search";

export const ScheduleStore = new Store({
    date: null,
    viewType: "month"
});

registerToolbar("Schedule");

export default function SchedulePage() {
    const translations = useTranslations();
    const [syncCounter, busy] = useSync();
    let sessions = useSessions([syncCounter], !busy);
    const { search } = useSearch(() => {
    });
    let { date, viewType } = ScheduleStore.useState();
    if (!date) {
        date = new Date();
    }

    const menuItems = [
        viewType !== "month" && {
            id: "month",
            name: translations.MONTH_VIEW,
            icon: <DateRangeIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewType = "month";
                });
            },
            divider: true
        },
        viewType !== "week" && {
            id: "week",
            name: translations.WEEK_VIEW,
            icon: <ViewWeekIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewType = "week";
                });
            },
            divider: true
        }
    ].filter(Boolean);

    useToolbar({ id: "Schedule", items: menuItems, depends: [translations, viewType] });

    const items = useMemo(() => {
        let items = sessions;
        if (search) {
            items = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
        }
        return items;
    }, [search, sessions]);

    return <div className={styles.root}>
        {viewType === "month" && <MonthView sessions={items} date={date} store={ScheduleStore} />}
        {viewType === "week" && <WeekView sessions={items} date={date} store={ScheduleStore} />}
    </div>;
}
