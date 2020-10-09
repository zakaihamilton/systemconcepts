import { useEffect, useCallback } from "react";
import styles from "./Form.module.scss";
import Progress from "./Progress";

function FormItem({ child, record, setRecord, validate }) {
    const { props } = child;
    const { id } = props;

    const setValue = useCallback(value => {
        setRecord(record => {
            return {
                ...record,
                [id]: value
            };
        });
    }, []);

    const state = [record && record[id], setValue];

    const element = React.cloneElement(child, {
        state,
        validate
    });

    return <div className={styles.item}>
        {element}
    </div>;
}

export function FormGroup({ children, record, setRecord, validate }) {
    const elements = React.Children.map(children, child => {
        if (!child) {
            return null;
        }
        return <FormItem child={child} record={record} setRecord={setRecord} validate={validate} />;
    }).filter(Boolean);
    return <div className={styles.group}>
        {elements}
    </div>;
}

export default function Form({ children, actions, data, loading, validate }) {
    const elements = React.Children.map(children, child => {
        if (!child) {
            return null;
        }
        return React.cloneElement(child, { validate });
    }).filter(Boolean);
    return <div className={styles.root}>
        {!loading && data && <form className={styles.form} noValidate>
            {elements}
        </form>}
        {loading && <Progress />}
        <div className={styles.actions}>
            {actions}
        </div>
    </div>;
}
