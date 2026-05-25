import Tab from "@mui/material/Tab";
import { useDeviceType } from "@util/browser/styles";
import clsx from "clsx";
import styles from "./Tab.module.css";

export default function TabWidget({ icon, label, value, ...props }) {
	const isPhone = useDeviceType() === "phone";
	const content = (
		<div className={clsx(styles.content, isPhone && styles.mobile)}>
			{icon}
			<div className={clsx(styles.label, isPhone && styles.mobile)}>
				{" "}
				{label}
			</div>
		</div>
	);
	return (
		<Tab className={styles.root} label={content} value={value} {...props} />
	);
}
