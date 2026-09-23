import { useCallback, useEffect, useRef } from "react";
import styles from "./Editor.module.css";

export default function EditorWidget({ state }: any) {
	const [value, setValue] = state;
	const ref = useRef<any>(null);
	useEffect(() => {
		ref.current.focus();
	}, []);

	const onChange = useCallback(
		(event: any) => {
			const { value } = event.target;
			setValue(value);
		},
		[setValue],
	);

	return (
		<textarea
			ref={ref}
			className={styles.root}
			value={value}
			onChange={onChange}
		/>
	);
}
