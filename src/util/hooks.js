import { useState, useCallback, useRef, useEffect } from 'react';

export function useCounter(defaultValue = 0) {
    const [counter, setCounter] = useState(defaultValue);
    const incrementCounter = useCallback(() => {
        setCounter(counter => counter + 1);
    }, []);
    return [counter, incrementCounter];
}

export function useHover() {
    const [value, setValue] = useState(false);

    const ref = useRef(null);

    const handleMouseEnter = () => setValue(true);
    const handleMouseLeave = () => setValue(false);

    useEffect(
        () => {
            const node = ref.current;
            if (node) {
                node.addEventListener('mouseenter', handleMouseEnter);
                node.addEventListener('mouseleave', handleMouseLeave);

                return () => {
                    node.removeEventListener('mouseenter', handleMouseEnter);
                    node.removeEventListener('mouseleave', handleMouseLeave);
                };
            }
        }, [ref.current]);

    return [ref, value];
}

let uniqueId = 1;

export function useUnique() {
    const idRef = useRef(null);
    if (idRef.current === null) {
        idRef.current = uniqueId++;
    }
    return idRef.current;
}