import styles from "./Row.module.scss";

export default function RowWidget({ children }) {
    return <div className={styles.root}>
        {children}
    </div>;
}
