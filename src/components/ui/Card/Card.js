import clsx from "clsx";
import styles from "../shared.module.css";

export function Card({ children, className, ...props }) {
	return (
		<div className={clsx(styles.card, className)} {...props}>
			{children}
		</div>
	);
}

export function CardContent({ children, className, ...props }) {
	return (
		<div className={clsx(styles.cardContent, className)} {...props}>
			{children}
		</div>
	);
}

export default Card;
