import Breadcrumbs from "@/components/Breadcrumbs";
import { useActivePages } from "@/util/pages";
import styles from "./Title.module.scss";

export default function Title() {
    const pages = useActivePages();
    return <Breadcrumbs className={styles.bar} items={pages} bar={true} />;
}
