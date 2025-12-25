import Breadcrumbs from "@components/Breadcrumbs";
import { useActivePages } from "@util/pages";
import styles from "./Title.module.scss";
import { useDeviceType } from "@util/styles";

export default function Title() {
    const pages = useActivePages();
    const isMobile = useDeviceType() !== "desktop";
    return <Breadcrumbs className={styles.bar} items={pages} bar={true} border={true} hideRoot={isMobile} />;
}
