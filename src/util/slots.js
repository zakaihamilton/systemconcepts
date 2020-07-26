import { useCounter } from "./hooks";
import { useEffect, useRef } from "react";

const slots = {};

export function useSlot(params) {
    const [counter, incCounter] = useCounter();
    const ref = useRef(null);
    const { key, ...props } = params;
    let slot = ref.current;
    if (!slot) {
        slot = ref.current = { ...props, update: incCounter };
        if (key) {
            slots[key] = slot;
        }
    }
    return [slot, counter];
}

export function getSlot(key) {
    return slots[key];
}
