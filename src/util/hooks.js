import { useState, useCallback, useRef, useEffect, useMemo } from "react";

export function useCounter(defaultValue = 0) {
    const [counter, setCounter] = useState(defaultValue);
    const incrementCounter = useCallback(() => {
        setCounter(counter => counter + 1);
    }, []);
    return [counter, incrementCounter];
}

export function useHover() {
    const [value, setValue] = useState(false);
    const [node, setNode] = useState(null);

    const handleMouseEnter = useCallback(() => setValue(true), []);
    const handleMouseLeave = useCallback(() => setValue(false), []);

    useEffect(() => {
        if (node) {
            node.addEventListener("mouseenter", handleMouseEnter);
            node.addEventListener("mouseleave", handleMouseLeave);
            return () => {
                node.removeEventListener("mouseenter", handleMouseEnter);
                node.removeEventListener("mouseleave", handleMouseLeave);
            };
        }
    }, [node, handleMouseEnter, handleMouseLeave]);

    return [setNode, value];
}

let uniqueId = 1;

export function useUnique() {
    const id = useMemo(() => uniqueId++, []);
    return id;
}

export function usePageVisibility() {
    const [isVisible, setIsVisible] = useState(typeof document !== "undefined" && document.visibilityState === "visible");
    const onVisibilityChange = () => setIsVisible(document.visibilityState === "visible");
    useEffect(() => {
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);
    return isVisible;
}
