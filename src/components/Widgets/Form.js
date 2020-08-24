import { useState } from "react";
import styles from "./Form.module.scss";

function FormItem({ child }) {
    const { props } = child;
    const { defaultValue } = props;
    const state = useState(defaultValue);
    const [value, setValue] = state;

    const element = React.cloneElement(child, {
        state
    });

    return <div className={styles.item}>
        {element}
    </div>;
}

export default function Form({ children, actions }) {
    const elements = React.Children.map(children, child => {
        return <FormItem child={child} />;
    });
    return <div className={styles.root}>
        <form className={styles.form} noValidate>
            {elements}
        </form>
        <div className={styles.actions}>
            {actions}
        </div>
    </div>;
}
