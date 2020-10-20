import { useRef, useEffect, useCallback } from "react";
import { useCounter } from "@/util/hooks";
import { Store } from "pullstate";

export const StateStore = new Store({});

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
    useEffect(() => {
        const unsubscribe = store.subscribe(s => s, s => {
            if (s._loaded) {
                let values = Object.assign({}, s);
                if (fields) {
                    Object.keys(values).map(key => {
                        if (!fields.includes(key)) {
                            delete values[key];
                        }
                    });
                }
                delete values._loaded;
                window.localStorage.setItem(id, JSON.stringify(values));
            }
        });
        const item = window.localStorage.getItem(id);
        if (item) {
            const obj = JSON.parse(item);
            store.update(s => {
                Object.assign(s, obj);
                s._loaded = true;
            });
        }
        else {
            store.update(s => {
                s._loaded = true;
            });
        }
        return () => {
            unsubscribe();
        }
    }, []);
}

export function useGlobalState(id, defaults) {
    const state = StateStore.useState(s => s[id]);
    useEffect(() => {
        if (typeof state === "undefined" && id) {
            StateStore.update(s => {
                s[id] = defaults;
            });
        }
    }, [state, id]);
    const setState = useCallback(data => {
        if (!id) {
            return;
        }
        StateStore.update(s => {
            if (typeof data === "function") {
                data = data(s[id]);
            }
            s[id] = data;
        });
    }, [id]);
    return [state, setState];
}