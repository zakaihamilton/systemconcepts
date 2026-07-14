import clsx from "clsx";
import { forwardRef } from "react";
import styles from "../shared.module.css";

const InputBase = forwardRef(function InputBase(
	{ className, classes = {}, ...props },
	ref,
) {
	return (
		<input
			ref={ref}
			className={clsx(styles.inputBase, classes.root, classes.input, className)}
			{...props}
		/>
	);
});

export default InputBase;
