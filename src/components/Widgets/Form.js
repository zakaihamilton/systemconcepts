import { useCallback, cloneElement, Children } from "react";
import styles from "./Form.module.scss";
import Progress from "./Progress";

function FormItem({ child, record, setRecord, validate }) {
    const { props } = child;
    const { id, field } = props;

    const setValue = useCallback(value => {
        setRecord(record => {
            return {
                ...record,
                ...(!field && { [id]: value }),
                ...(field && { [id]: { ...record[id], [field]: value } })
            };
        });
    }, [id, field]);

    const value = !!field ? record && record[id] && record[id][field] : record && record[id];
    const state = [value, setValue];

    const element = cloneElement(child, {
        state,
        validate: validate ? validate : undefined
    });

    return <div className={styles.item}>
        {element}
    </div>;
}

export function FormGroup({ children, record, setRecord, validate }) {
    const elements = Children.map(children, child => {
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
    const elements = Children.map(children, child => {
        if (!child) {
            return null;
        }
        return cloneElement(child, { validate: validate ? validate : undefined });
    }).filter(Boolean);
    return <div className={styles.root}>
        {!loading && data && <form className={styles.form} noValidate>
            {elements}
        </form>}
        {loading && <Progress />}
        {!loading && <div className={styles.actions}>
            {actions}
        </div>}
    </div>;
}
