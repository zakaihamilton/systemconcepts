import clsx from "clsx";
import styles from "../shared.module.css";

export default function AppBar({ children, className, position, ...props }) {
	return (
		<header className={clsx(styles.appBar, className)} {...props}>
			{children}
		</header>
	);
}

export function Toolbar({ children, className, ...props }) {
	return (
		<div className={clsx(styles.toolbar, className)} {...props}>
			{children}
		</div>
	);
}
