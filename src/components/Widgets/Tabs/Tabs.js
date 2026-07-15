import Tabs from "@ui/Tabs";
import clsx from "clsx";
import styles from "./Tabs.module.css";

export default function TabsWidget({ state, children, className, ...props }) {
	const [value, setValue] = state;

	const handleChange = (_event, newValue) => {
		setValue(newValue);
	};

	const foundValue =
		children &&
		children.find((item) => {
			return item.props.value === value;
		});

	return (
		<Tabs
			value={foundValue ? value : false}
			className={clsx(styles.root, className)}
			onChange={handleChange}
			{...props}
		>
			{children}
		</Tabs>
	);
}
