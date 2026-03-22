import Breadcrumbs from "@components/Breadcrumbs";
import { useActivePages } from "@util/views";
import styles from "./Title.module.css";
import { useDeviceType } from "@util/styles";
import { ScheduleStore } from "@views/Schedule";
import { SessionsStore } from "@util/sessions";

import { LibraryStore } from "@views/Library/Store";

export default function Title() {
    const { viewMode } = ScheduleStore.useState();
    const { viewMode: sessionsViewMode } = SessionsStore.useState();
    const { tags } = LibraryStore.useState();
    const pages = useActivePages([viewMode, sessionsViewMode, tags]);
    const isMobile = useDeviceType() !== "desktop";
    return <Breadcrumbs className={styles.bar} items={pages} bar={true} border={true} hideRoot={isMobile} />;
}
