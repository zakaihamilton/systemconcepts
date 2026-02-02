import { useMemo, useEffect } from "react";
import styles from "./Schedule.module.scss";
import MonthView from "./Schedule/MonthView";
import WeekView from "./Schedule/WeekView";
import HistoryView from "./Schedule/HistoryView";
import { Store } from "pullstate";
import { useSessions, SessionsStore } from "@util/sessions";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import ViewDayIcon from "@mui/icons-material/ViewDay";
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
import clsx from "clsx";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TracksView from "@pages/Schedule/TracksView";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RestoreIcon from '@mui/icons-material/Restore';
import { PlayerStore } from "@pages/Player";
import { SyncActiveStore } from "@sync/syncState";

export const ScheduleStore = new Store({
    date: null,
    viewMode: "week",
    lastViewMode: null,
    showBadges: false
});

registerToolbar("Schedule");


export default function SchedulePage() {
    const isMobile = useDeviceType() === "phone";
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    let [sessions, loading] = useSessions([], { showToolbar: false });
    const search = useSearch("schedule");
    let { date, viewMode } = ScheduleStore.useState();
    const { showFilterDialog } = SessionsStore.useState();
    const { session } = PlayerStore.useState();
    const playingSession = session;

    if (!date) {
        date = new Date();
    }
    useLocalStorage("ScheduleStore", ScheduleStore, ["viewMode", "lastViewMode", "showBadges"]);

    // Watch for sync completion and reload sessions if needed
    const needsSessionReload = SyncActiveStore.useState(s => s.needsSessionReload);
    const syncBusy = SyncActiveStore.useState(s => s.busy);

    useEffect(() => {
        // Only reload after sync completes (not during)
        if (needsSessionReload && !syncBusy) {
            // Force session reload by clearing sessions and marking as not busy
            // This will trigger the useSessions hook to reload data
            SessionsStore.update(s => {
                s.sessions = null;
                s.busy = false;
            });
            // Clear the flag to acknowledge the reload
            SyncActiveStore.update(s => {
                s.needsSessionReload = false;
            });
        }
    }, [needsSessionReload, syncBusy]);

    const viewOptions = [
        {
            id: "year",
            name: translations.YEAR_VIEW,
            icon: <CalendarViewMonthIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "year";
                    s.lastViewMode = null;
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
                    s.lastViewMode = null;
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
                    s.lastViewMode = null;
                });
            }
        },
        {
            id: "day",
            name: translations.DAY_VIEW,
            icon: <ViewDayIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "day";
                    s.lastViewMode = null;
                });
            }
        },
        {
            id: "tracks",
            name: translations.TRACKS_VIEW,
            icon: <ViewStreamIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "tracks";
                    s.lastViewMode = null;
                });
            }
        },
        {
            id: "history",
            name: translations.HISTORY_VIEW,
            icon: <RestoreIcon />,
            onClick: () => {
                ScheduleStore.update(s => {
                    s.viewMode = "history";
                    s.lastViewMode = null;
                });
            }
        }
    ];

    const toolbarItems = [];
    if (!isMobile) {
        const viewGroup = (
            <div className={styles.viewGroup}>
                {viewOptions.map(item => {
                    const isSelected = viewMode === item.id;
                    return (
                        <Tooltip title={item.name} key={item.id}>
                            <IconButton
                                onClick={item.onClick}
                                className={clsx(styles.viewGroupButton, isSelected && styles.selected)}
                                size="small"
                            >
                                {item.icon}
                            </IconButton>
                        </Tooltip>
                    );
                })}
            </div>
        );
        toolbarItems.push({
            id: "viewGroup",
            element: viewGroup,
            location: "header"
        });
    }

    toolbarItems.push({
        id: "filter",
        name: translations.FILTER,
        icon: <FilterAltIcon />,
        location: isMobile ? "mobile" : "header",
        onClick: () => {
            SessionsStore.update(s => {
                s.showFilterDialog = !s.showFilterDialog;
            });
        },
        active: showFilterDialog
    });

    useToolbar({ id: "Schedule", items: toolbarItems, depends: [translations, viewMode, isMobile, showFilterDialog] });

    const items = useMemo(() => {
        let items = sessions;
        if (search) {
            const searchLower = search.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchLower) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
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
        {!isMobile && <FilterBar hideYears={viewMode !== "tracks"} />}
        <div className={clsx(styles.content, isMobile && styles.mobile, viewMode === "tracks" && styles.noScroll)}>
            {!loading && viewMode === "year" && <YearView sessions={items} date={date} store={ScheduleStore} playingSession={playingSession} />}
            {!loading && viewMode === "month" && <MonthView sessions={items} date={date} store={ScheduleStore} playingSession={playingSession} />}
            {!loading && viewMode === "week" && <WeekView sessions={items} date={date} store={ScheduleStore} playingSession={playingSession} />}
            {!loading && viewMode === "day" && <DayView sessions={items} date={date} store={ScheduleStore} playingSession={playingSession} />}
            {!loading && viewMode === "tracks" && <TracksView
                sessions={items}
                loading={loading}
                store={ScheduleStore}
                translations={translations}
                viewModes={{ tracks: {} }}
                playingSession={playingSession}
            />}
            {!loading && viewMode === "history" && <HistoryView />}
            {!!loading && loadingElement}
        </div>
        {!!isMobile && <FilterBar hideYears={viewMode !== "tracks"} />}
    </div>;
}
