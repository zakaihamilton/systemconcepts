import { logger as structuredLogger } from "@util/api/logger";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

export function useCounter(defaultValue = 0): [number, () => void] {
	const [counter, setCounter] = useState(defaultValue);
	const incrementCounter = useCallback(() => {
		setCounter((counter) => counter + 1);
	}, []);
	return [counter, incrementCounter];
}

export function useHover(): [
	Dispatch<SetStateAction<HTMLElement | null>>,
	boolean,
] {
	const [value, setValue] = useState(false);
	const [node, setNode] = useState<HTMLElement | null>(null);

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

export function useUnique(): number {
	const id = useMemo(() => uniqueId++, []);
	return id;
}

export function usePageVisibility(): boolean {
	const [isVisible, setIsVisible] = useState(
		typeof document !== "undefined" && document.visibilityState === "visible",
	);
	const onVisibilityChange = () =>
		setIsVisible(document.visibilityState === "visible");
	useEffect(() => {
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);
	return isVisible;
}

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
	const [storedValue, setStoredValue] = useState(() => {
		if (typeof window === "undefined") {
			return initialValue;
		}
		try {
			const item = window.localStorage.getItem(key);
			return item ? (JSON.parse(item) as T) : initialValue;
		} catch (error: any) {
			structuredLogger.debug(error);
			return initialValue;
		}
	});

	const setValue = useCallback(
		(value: SetStateAction<T>) => {
			try {
				const valueToStore =
					value instanceof Function ? value(storedValue) : value;
				setStoredValue(valueToStore);
				if (typeof window !== "undefined") {
					window.localStorage.setItem(key, JSON.stringify(valueToStore));
				}
			} catch (error: any) {
				structuredLogger.debug(error);
			}
		},
		[key, storedValue],
	);

	return [storedValue, setValue];
}
