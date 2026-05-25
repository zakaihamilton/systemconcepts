import Tab from "@mui/material/Tab";
import { useTranslations } from "@util/translations";
import Tabs from "@widgets/Tabs";
import { useEffect, useState } from "react";
import Library from "../Library";
import Sessions from "../Sessions";
import styles from "./Tags.module.css";

export default function Tags() {
	const translations = useTranslations();
	const [tab, setTab] = useState(() => {
		return (
			(typeof window !== "undefined" &&
				window.localStorage.getItem("tags_tab")) ||
			"sessions"
		);
	});

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem("tags_tab", tab);
		}
	}, [tab]);

	return (
		<div className={styles.container}>
			<Tabs state={[tab, setTab]} className={styles.tabs}>
				<Tab label={translations.SESSIONS || "Sessions"} value="sessions" />
				<Tab label={translations.LIBRARY || "Library"} value="library" />
			</Tabs>
			<div className={styles.content}>
				{tab === "sessions" && <Sessions />}
				{tab === "library" && <Library />}
			</div>
		</div>
	);
}
