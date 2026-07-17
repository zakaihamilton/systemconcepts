import { useLayoutEffect, useRef } from "react";
import styles from "./ViewTransition.module.css";

/**
 * Replays the entering animation whenever transitionKey changes without
 * remounting children. Keep the key limited to navigation/view state so data
 * and filter updates remain static.
 */
export default function ViewTransition({ transitionKey, children, className }) {
	const ref = useRef(null);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}
		element.classList.remove(styles.enter);
		void element.offsetWidth;
		element.classList.add(styles.enter);
	}, [transitionKey]);

	return (
		<div
			ref={ref}
			className={[styles.root, className].filter(Boolean).join(" ")}
			data-testid="view-transition"
			data-transition-key={transitionKey}
		>
			{children}
		</div>
	);
}
