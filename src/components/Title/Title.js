import Breadcrumbs from "@components/Breadcrumbs";
import { useDeviceType } from "@util/browser/styles";
import { SessionsStore } from "@util/domain/sessions";
import { useActivePages } from "@util/domain/views";
import { LibraryStore } from "@views/Library/Store";
import { ScheduleStore } from "@views/Schedule/Schedule";
import styles from "./Title.module.css";

export default function Title() {
	const { viewMode } = ScheduleStore.useState();
	const { viewMode: sessionsViewMode } = SessionsStore.useState();
	const { tags } = LibraryStore.useState();
	const pages = useActivePages([viewMode, sessionsViewMode, tags]);
	const isMobile = useDeviceType() !== "desktop";
	return (
		<Breadcrumbs
			className={styles.bar}
			items={pages}
			bar={true}
			border={true}
			hideRoot={isMobile}
		/>
	);
}
