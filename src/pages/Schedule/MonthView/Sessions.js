import { useDateFormatter } from "@util/locale";
import Dialog from "@widgets/Dialog";
import Session from "../WeekView/Session";
import styles from "./Sessions.module.scss";
import { useSwipe } from "@util/touch";
import SwipeIndicator from "@widgets/SwipeIndicator";
import clsx from "clsx";

export default function Sessions({ open, onClose, date, items, onSwipeLeft, onSwipeRight, direction }) {
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
        // Extract session data from the item
        const sessionProps = {
            name: item.name,
            group: item.description?.toLowerCase(),
            color: item.backgroundColor,
            type: item.type,
            year: new Date(item.date).getFullYear(),
            date: item.date,
            showGroup: true
        };
        return <Session key={item.id} {...sessionProps} />;
    });

    return <>
        <Dialog
            title={dialogDateFormatter.format(date)}
            onClose={onClose}
            className={clsx(styles.root, direction === "rtl" && styles.rtl)}
            {...swipeHandlers}
        >
            <div className={styles.list}>
                {sessionElements}
            </div>
        </Dialog>
        <SwipeIndicator direction={swipeDirection} />
    </>;
}
