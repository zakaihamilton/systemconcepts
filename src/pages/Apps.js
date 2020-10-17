import styles from "./Apps.module.scss";
import { usePages, setPath } from "@/util/pages";

export default function Apps() {
    const pages = usePages();

    const items = pages.filter(page => page.apps && !page.category).map(page => {
        const { Icon } = page;
        return <div key={page.id} className={styles.item} onClick={() => setPath(page.id)}>
            <Icon className={styles.icon} fontSize="large" />
            <div className={styles.label}>
                {page.name}
            </div>
        </div>
    }).sort((a, b) => a.name - b.name);

    return <div className={styles.root}>
        {items}
    </div>;
}
