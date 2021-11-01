import styles from "./Apps.module.scss";
import { usePages, setPath } from "@util/pages";
import Link from "@material-ui/core/Link";

export default function Apps() {
    const pages = usePages();

    const items = pages.filter(page => page.apps && !page.category).sort((a, b) => a.name.localeCompare(b.name));
    const elements = items.map(page => {
        const { Icon } = page;
        return <Link href={"#" + page.id} underline="none" key={page.id} className={styles.item} onClick={() => setPath(page.id)}>
            <Icon className={styles.icon} fontSize="large" />
            <div className={styles.label}>
                {page.name}
            </div>
        </Link>;
    });

    return <div className={styles.root}>
        {elements}
    </div>;
}
