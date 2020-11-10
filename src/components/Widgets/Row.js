import styles from "./Row.module.scss";
import clsx from "clsx";
import { useDirection } from "@util/direction";

export default function RowWidget({ className, style, border, fill = true, basePadding = 8, iconPadding = 60, onClick, children, icons, ...props }) {
    const direction = useDirection();
    const paddingDirection = direction === "rtl" ? "paddingRight" : "paddingLeft";
    const backgroundStyle = { [paddingDirection]: (basePadding + iconPadding) + "px" };
    const contentStyle = { [paddingDirection]: basePadding + "px" };
    return <div className={clsx(styles.root, fill && styles.fill, className)} style={style} {...props}>
        <div className={clsx(styles.background, onClick && styles.clickable, border && styles.border)} style={backgroundStyle} onClick={onClick ? onClick : undefined}>
            {children}
        </div>
        <div className={styles.icons} style={contentStyle}>
            {icons}
        </div>
    </div>
}
