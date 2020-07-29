import styles from "./Label.module.scss";

export default function LabelWidget({ icon: Icon, name }) {
    return <div className={styles.root}>{Icon && <Icon />}{name}</div>;
}
