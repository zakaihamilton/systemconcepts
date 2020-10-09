import styles from "./Apps.module.scss";
import { usePages, setPath } from "@/util/pages";
import { useTranslations } from "@/util/translations";

export default function Apps() {
    const pages = usePages();
    const translations = useTranslations();

    const items = pages.filter(page => page.apps && !page.category).map(page => {
        const { Icon } = page;
        return <div key={page.id} className={styles.item} onClick={() => setPath(page.id)}>
            <Icon className={styles.icon} fontSize="large" />
            <div className={styles.label}>
                {page.name}
            </div>
        </div>
    });

    return <div className={styles.root}>
        {items}
    </div>;
}
