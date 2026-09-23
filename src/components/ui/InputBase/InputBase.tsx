import clsx from "clsx";
import { forwardRef } from "react";
import styles from "../shared.module.css";

const InputBase = forwardRef<any, any>(function InputBase(
	{ className, classes = {}, inputRef, inputProps = {}, ...props }: any,
	ref,
) {
	const setRefs = (node: any) => {
		if (typeof ref === "function") {
			ref(node);
		} else if (ref) {
			ref.current = node;
		}
		if (typeof inputRef === "function") {
			inputRef(node);
		} else if (inputRef) {
			inputRef.current = node;
		}
	};

	return (
		<input
			ref={setRefs}
			className={clsx(styles.inputBase, classes.root, classes.input, className)}
			{...inputProps}
			{...props}
		/>
	);
});

export default InputBase;
