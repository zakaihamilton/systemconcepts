import styles from "./Row.module.scss";
import clsx from "clsx";

export default function RowWidget({ className, style, basePadding, iconPadding, onClick, children, icons, ...props }) {
    const backgroundStyle = { paddingLeft: (basePadding + iconPadding) + "px" };
    const contentStyle = { paddingLeft: basePadding + "px" };
    return <div className={clsx(styles.root, className)} style={style} {...props}>
        <div className={styles.background} style={backgroundStyle} onClick={onClick}>
            {children}
        </div>
        <div className={styles.icons} style={contentStyle}>
            {icons}
        </div>
    </div>
}
