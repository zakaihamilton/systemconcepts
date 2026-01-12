import styles from "./Row.module.scss";
import clsx from "clsx";
import { useDirection } from "@util/direction";
import Link from "@mui/material/Link";

export default function RowWidget({ className, href, style, fill = true, basePadding = 8, iconPadding = 60, onClick, children, icons, ...props }) {
    const direction = useDirection();
    const paddingDirection = direction === "rtl" ? "paddingRight" : "paddingLeft";
    const backgroundStyle = { [paddingDirection]: (basePadding + iconPadding) + "px" };
    const contentStyle = { [paddingDirection]: basePadding + "px" };
    return <div className={clsx(styles.root, fill && styles.fill, className)} style={style} {...props}>
        <Link
            href={href ? href : undefined}
            component={!href && onClick ? "button" : undefined}
            color="inherit"
            underline="none"
            className={clsx(styles.background, onClick && styles.clickable)}
            style={backgroundStyle}
            onClick={onClick ? onClick : undefined}
        >
            {children}
        </Link>
        <div className={styles.icons} style={contentStyle}>
            {icons}
        </div>
    </div>;
}
