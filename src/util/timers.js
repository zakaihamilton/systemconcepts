import { useRef, useEffect } from "react";

export function useInterval(callback, delay, depends = []) {
    const savedCallback = useRef();
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    useEffect(() => {
        function tick() {
            const { current } = savedCallback;
            if (current) {
                current();
            }
        }
        if (delay) {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [...depends, delay]);
}

export function useTimer(callback, delay, depends = []) {
    const savedCallback = useRef();
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    useEffect(() => {
        function tick() {
            const { current } = savedCallback;
            if (current) {
                current();
            }
        }
        if (delay) {
            let id = setTimeout(tick, delay);
            return () => clearTimeout(id);
        }
    }, [...depends, delay]);
}
