import { useState, useEffect } from "react";
import styles from "./Form.module.scss";
import Progress from "./Progress";

function FormItem({ child, record }) {
    const { props } = child;
    const { id } = props;
    const state = useState();
    const [, setValue] = state;

    useEffect(() => {
        if (record) {
            setValue(record[id]);
        }
    }, [record]);

    const element = React.cloneElement(child, {
        state
    });

    return <div className={styles.item}>
        {element}
    </div>;
}

export function FormGroup({ children, record }) {
    const elements = React.Children.map(children, child => {
        return <FormItem child={child} record={record} />;
    });
    return <div className={styles.group}>
        {elements}
    </div>;
}

export default function Form({ children, actions, loading }) {
    return <div className={styles.root}>
        {!loading && <form className={styles.form} noValidate>
            {children}
        </form>}
        {loading && <Progress />}
        <div className={styles.actions}>
            {actions}
        </div>
    </div>;
}
