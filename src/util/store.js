import { useRef, useEffect, useState } from "react";
import { useCounter } from "@/util/hooks";

export function useStoreState(store, filter) {
    const storeState = store.useState(filter);
    const ref = useRef({});
    const states = ref.current;
    const [counter, incCounter] = useCounter();
    Object.keys(storeState || {}).forEach(key => {
        const value = storeState[key];
        let state = states[key];
        if (!state) {
            state = states[key] = [value, (value) => {
                store.update(s => {
                    s[key] = value;
                });
                incCounter();
            }];
        }
        state[0] = value;
    });
    return states;
}

export function useLocalStorage(id, store, fields) {
    const isLoaded = useRef(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        const unsubscribe = store.subscribe(s => s, s => {
            if (isLoaded.current) {
                let values = Object.assign({}, s);
                if (fields) {
                    Object.keys(values).map(key => {
                        if (!fields.includes(key)) {
                            delete values[key];
                        }
                    });
                }
                window.localStorage.setItem(id, JSON.stringify(values));
            }
        });
        const item = window.localStorage.getItem(id);
        if (item) {
            const obj = JSON.parse(item);
            store.update(s => {
                Object.assign(s, obj);
                isLoaded.current = true;
            });
            setLoaded(true);
        }
        else {
            isLoaded.current = true;
            setLoaded(true);
        }
        return () => {
            unsubscribe();
        }
    }, []);
    return loaded;
}