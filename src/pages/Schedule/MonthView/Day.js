import styles from "./Day.module.scss";

export default function Day({ column, row }) {
    const style = {
        gridColumn: column,
        gridRow: row
    }
    return <div className={styles.root} style={style}>

    </div>
}