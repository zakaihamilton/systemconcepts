import styles from "./Field.module.scss";

export default function Field({ name, value }) {
    return <div className={styles.root}>
        <div className={styles.name}>
            {name}:
        </div>
        <div className={styles.value}>
            {value}
        </div>
    </div>
}