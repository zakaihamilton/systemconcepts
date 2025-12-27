import { useDateFormatter } from "@util/locale";
import Dialog from "@widgets/Dialog";
import Session from "./Sessions/Session";
import styles from "./Sessions.module.scss";
import { useSwipe } from "@util/touch";
import clsx from "clsx";
import { useDeviceType } from "@util/styles";

export default function Sessions({ open, onClose, date, items, onSwipeLeft, onSwipeRight, direction }) {
    const isMobile = useDeviceType() === "phone";
    const dialogDateFormatter = useDateFormatter({ dateStyle: "full" });
    const { swipeDirection, ...swipeHandlers } = useSwipe({
        onSwipeLeft,
        onSwipeRight
    });

    if (!open) {
        return null;
    }

    // Sort sessions by group and type, just like WeekView
    const sortedItems = [...items].sort((a, b) => {
        const groupA = a.description || "";
        const groupB = b.description || "";
        const groupCompare = groupA.localeCompare(groupB);
        if (groupCompare !== 0) return groupCompare;
        return (a.typeOrder || 0) - (b.typeOrder || 0);
    });

    const sessionElements = sortedItems.map(item => {
        return <Session
            key={item.id}
            name={item.name}
            group={item.description?.toLowerCase()}
            color={item.backgroundColor}
            type={item.type}
            year={new Date(item.date).getFullYear()}
            date={item.date}
            showGroup={true}
            small={true}
        />;
    });

    return <>
        <Dialog
            title={dialogDateFormatter.format(date)}
            onClose={onClose}
            className={clsx(styles.root, direction === "rtl" && styles.rtl)}
            {...swipeHandlers}
        >
            <div className={clsx(styles.list, isMobile && styles.mobile)}>
                {sessionElements}
            </div>
        </Dialog>
    </>;
}
