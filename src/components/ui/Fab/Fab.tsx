import clsx from "clsx";
import { forwardRef } from "react";
import styles from "../shared.module.css";

const Fab = forwardRef<any, any>(function Fab(
	{ children, className, color = "primary", onClick, ...props }: any,
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
