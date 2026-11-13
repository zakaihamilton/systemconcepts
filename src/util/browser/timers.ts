import { useEffect, useRef } from "react";

export function useInterval(
	callback: any,
	delay: any,
	depends: unknown[] = [],
) {
	const savedCallback = useRef<any>(null);
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

export function useTimeout(callback: any, delay: any, depends: unknown[] = []) {
	const savedCallback = useRef<any>(null);
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
