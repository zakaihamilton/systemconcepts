import { useRef, useEffect } from "react";
import { useCounter } from "@/util/hooks";

export function useStoreState(store, filter) {
    const storeState = store.useState(filter);
    const ref = useRef({});
    const states = ref.current;
    const [counter, incCounter] = useCounter();
    const keys = Object.keys(storeState || {}).map(key => {
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

export function useLocalStorage(id, store) {
    const isLoaded = useRef(false);
    useEffect(() => {
        const unsubscribe = store.subscribe(s => s, s => {
            if (isLoaded.current) {
                window.localStorage.setItem(id, JSON.stringify(s));
            }
        });
        const item = window.localStorage.getItem(id);
        if (item) {
            const obj = JSON.parse(item);
            store.update(s => {
                Object.assign(s, obj);
                isLoaded.current = true;
            });
        }
        else {
            isLoaded.current = true;
        }
        return () => {
            unsubscribe();
        }
    }, []);
    return store;
}