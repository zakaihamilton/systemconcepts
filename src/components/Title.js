import Breadcrumbs from "@components/Breadcrumbs";
import { useActivePages } from "@util/pages";
import styles from "./Title.module.scss";
import { useDeviceType } from "@util/styles";
import { ScheduleStore } from "@pages/Schedule";
import { SessionsStore } from "@util/sessions";

export default function Title() {
    const { viewMode } = ScheduleStore.useState();
    const { viewMode: sessionsViewMode } = SessionsStore.useState();
    const pages = useActivePages([viewMode, sessionsViewMode]);
    const isMobile = useDeviceType() !== "desktop";
    return <Breadcrumbs className={styles.bar} items={pages} bar={true} border={true} hideRoot={isMobile} />;
}
