import { useEffect, useRef, useCallback } from "react";
import styles from "./Editor.module.scss";

export default function EditorWidget({ state }) {
    const [value, setValue] = state;
    const ref = useRef();
    useEffect(() => {
        ref.current.focus();
    }, []);

    const onChange = useCallback(event => {
        const { value } = event.target;
        setValue(value);
    }, [setValue]);

    return <textarea ref={ref} className={styles.root} value={value} onChange={onChange} />;
}
