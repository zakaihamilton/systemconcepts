import styles from "./Group.module.scss";

export default function Group({ name, color }) {
    const groupName = name[0].toUpperCase() + name.slice(1);
    const style = { backgroundColor: color };
    return <div className={styles.groupContainer}>
        <div className={styles.background} style={style} />
        <div className={styles.group} dir="auto">
            {groupName}
        </div>
        <div className={styles.backgroundBorder} style={style} />
    </div>;
};