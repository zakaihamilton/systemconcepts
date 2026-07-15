import clsx from "clsx";
import { forwardRef } from "react";
import styles from "../shared.module.css";

const Fab = forwardRef(function Fab(
	{ children, className, color = "primary", onClick, ...props },
	ref,
) {
	return (
		<button
			ref={ref}
			type="button"
			className={clsx(styles.fab, className)}
			onClick={onClick}
			{...props}
		>
			{children}
		</button>
	);
});

export default Fab;
