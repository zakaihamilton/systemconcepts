import { useState, useCallback } from 'react';

export function useCounter(defaultValue = 0) {
    const [counter, setCounter] = useState(defaultValue);
    const incrementCounter = useCallback(() => {
        setCounter(counter => counter + 1);
    }, []);
    return [counter, incrementCounter];
}
