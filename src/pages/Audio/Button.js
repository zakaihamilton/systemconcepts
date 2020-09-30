import styles from "./Button.module.scss";

export default function Button({ id, name, icon, subHeading, onClick, ...props }) {
    return <button className={styles.root} onClick={onClick} {...props}>
        <div className={styles.icon}>
            {icon}
        </div>
        <div className={styles.label}>
            {name}
        </div>
        {subHeading && <div className={styles.subHeading}>
            {subHeading}
        </div>}
    </button>
}