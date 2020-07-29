import React, { useRef } from "react";
import { useCounter } from "@/util/hooks";

export function useStoreState(store) {
    const storeState = store.useState();
    const ref = useRef({});
    const states = ref.current;
    const [counter, incCounter] = useCounter();
    const keys = Object.keys(storeState).map(key => {
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
