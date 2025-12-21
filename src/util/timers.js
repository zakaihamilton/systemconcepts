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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...depends, delay]);
}

export function useTimeout(callback, delay, depends = []) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...depends, delay]);
}
