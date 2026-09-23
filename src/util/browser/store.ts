import { useCounter } from "@util/browser/hooks";
import { Store } from "pullstate";
import { useCallback, useEffect, useRef } from "react";

type StateRecord = Record<string, any>;

type FlexibleStoreValue<T> =
	T extends ReadonlyArray<any>
		? any[]
		: T extends null
			? any
			: T extends object
				? keyof T extends never
					? Record<string, any>
					: T
				: T;

export type FlexibleStoreState<T extends object> = {
	[K in keyof T]: FlexibleStoreValue<T[K]>;
} & Record<string, any>;

export function createStore<T extends object>(
	initialState: T,
): Store<FlexibleStoreState<T>> {
	return new Store(initialState as FlexibleStoreState<T>);
}

export const StateStore = new Store<StateRecord>({});

export function useStoreState<
	T extends StateRecord,
	K extends keyof T = keyof T,
>(
	store: Store<T>,
	filter?: (state: T) => Pick<T, K>,
): { [P in K]: [T[P], (value: T[P]) => void] } {
	const storeState = store.useState(
		filter || ((state: T) => state as Pick<T, K>),
	);
	const ref = useRef<Partial<{ [P in K]: [T[P], (value: T[P]) => void] }>>({});
	const states = ref.current;
	const [, incCounter] = useCounter();
	(Object.keys(storeState || {}) as K[]).forEach((key) => {
		const value = storeState[key];
		let state = states[key];
		if (!state) {
			state = states[key] = [
				value,
				(value) => {
					store.update((s) => {
						(s as T)[key] = value;
					});
					incCounter();
				},
			];
		}
		state[0] = value;
	});
	return states as { [P in K]: [T[P], (value: T[P]) => void] };
}

export function useLocalStorage<T extends StateRecord & { _loaded?: boolean }>(
	id: string,
	store: Store<T>,
	fields?: (keyof T)[],
) {
	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const unsubscribe = store.subscribe(
			(s) => s,
			(s) => {
				const state = s as T;
				if (state._loaded) {
					let values = Object.assign({}, s);
					if (fields) {
						Object.keys(values).map((key) => {
							if (!fields.includes(key)) {
								delete values[key];
							}
						});
					}
					delete values._loaded;
					try {
						window.localStorage.setItem(id, JSON.stringify(values));
					} catch {
						// Quota, private mode, or a suspended mobile WebView.
					}
				}
			},
		);
		try {
			const item = window.localStorage.getItem(id);
			if (item) {
				const obj = JSON.parse(item) as Partial<T>;
				if (fields) {
					(Object.keys(obj) as (keyof T)[]).map((key) => {
						if (!fields.includes(key)) {
							delete obj[key];
						}
					});
				}
				store.update((s) => {
					Object.assign(s, obj);
					(s as T)._loaded = true;
				});
			} else {
				store.update((s) => {
					(s as T)._loaded = true;
				});
			}
		} catch {
			store.update((s) => {
				(s as T)._loaded = true;
			});
		}
		return () => {
			unsubscribe();
		};
	}, [fields, id, store]);
}

export function useGlobalState<T>(
	id: string | null | undefined,
	defaults: T,
): [T, (data: T | ((previous: T) => T)) => void] {
	const state = StateStore.useState(
		(s) => (id ? (s[id] as T | undefined) : undefined),
		[id],
	);
	useEffect(() => {
		if (typeof state === "undefined" && id) {
			StateStore.update((s) => {
				s[id] = defaults;
			});
		}
	}, [state, id, defaults]);
	const setState = useCallback(
		(data: T | ((previous: T) => T)) => {
			if (!id) {
				return;
			}
			StateStore.update((s) => {
				if (typeof data === "function") {
					data = (data as (previous: T) => T)(
						(s[id] as T | undefined) ?? defaults,
					);
				}
				s[id] = data;
			});
		},
		[id],
	);
	return [state ?? defaults, setState];
}
