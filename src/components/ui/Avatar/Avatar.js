import clsx from "clsx";
import styles from "../shared.module.css";

export default function Avatar({ children, className, src, alt, ...props }) {
	if (src) {
		return (
			<img
				src={src}
				alt={alt || ""}
				className={clsx(styles.avatar, className)}
				{...props}
			/>
		);
	}
	return (
		<span className={clsx(styles.avatar, className)} {...props}>
			{children}
		</span>
	);
}
