import { useDateFormatter } from "@util/locale";
import Dialog from "@widgets/Dialog";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";
import Link from "@mui/material/Link";
import Avatar from "@mui/material/Avatar";
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

    return <>
        <Dialog
            title={dialogDateFormatter.format(date)}
            onClose={onClose}
            className={clsx(styles.root, direction === "rtl" && styles.rtl)}
            {...swipeHandlers}
        >
            <List className={styles.list}>
                {items.map(item => {
                    const { id, name, description, icon, backgroundColor, style, target, onClick } = item;
                    return <ListItem disablePadding key={id}>
                        <ListItemButton onClick={(e) => { onClick(e); onClose(); }} component={target ? Link : "div"} underline="none" href={target}>
                            <ListItemAvatar>
                                <Avatar style={{ backgroundColor, ...style }}>
                                    {icon}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText primary={name} secondary={description} />
                        </ListItemButton>
                    </ListItem>;
                })}
            </List>
        </Dialog>
        <SwipeIndicator direction={swipeDirection} />
    </>;
}
