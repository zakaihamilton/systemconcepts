import styles from "./Row.module.scss";
import clsx from "clsx";
import { useDirection } from "@util/direction";

export default function RowWidget({ className, style, basePadding, iconPadding, onClick, children, icons, ...props }) {
    const direction = useDirection();
    const paddingDirection = direction === "rtl" ? "paddingRight" : "paddingLeft";
    const backgroundStyle = { [paddingDirection]: (basePadding + iconPadding) + "px" };
    const contentStyle = { [paddingDirection]: basePadding + "px" };
    return <div className={clsx(styles.root, className)} style={style} {...props}>
        <div className={styles.background} style={backgroundStyle} onClick={onClick}>
            {children}
        </div>
        <div className={styles.icons} style={contentStyle}>
            {icons}
        </div>
    </div>
}
