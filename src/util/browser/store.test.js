import { act, renderHook } from "@testing-library/react";
import { Store } from "pullstate";
import {
	StateStore,
	useGlobalState,
	useLocalStorage,
	useStoreState,
} from "./store";

describe("useStoreState", () => {
	it("exposes a [value, setter] tuple for each key in the store", () => {
		const store = new Store({ count: 1, name: "a" });
		const { result } = renderHook(() => useStoreState(store));
		expect(result.current.count[0]).toBe(1);
		expect(result.current.name[0]).toBe("a");
	});

	it("updates the underlying store when a setter is called", () => {
		const store = new Store({ count: 1 });
		const { result } = renderHook(() => useStoreState(store));

		act(() => {
			result.current.count[1](2);
		});

		expect(store.getRawState().count).toBe(2);
		expect(result.current.count[0]).toBe(2);
	});

	it("supports a filter to select a subset of the state", () => {
		const store = new Store({ a: 1, b: 2 });
		const { result } = renderHook(() =>
			useStoreState(store, (s) => ({ a: s.a })),
		);
		expect(Object.keys(result.current)).toEqual(["a"]);
	});
});

describe("useLocalStorage (store)", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("loads persisted fields into the store on mount", () => {
		window.localStorage.setItem(
			"my-store",
			JSON.stringify({ theme: "dark", ignored: true }),
		);
		const store = new Store({});
		renderHook(() => useLocalStorage("my-store", store, ["theme"]));
		expect(store.getRawState()).toEqual({ theme: "dark", _loaded: true });
	});

	it("does not restore omitted fields such as a stale navigation hash", () => {
		window.localStorage.setItem(
			"main-store-hash",
			JSON.stringify({
				hash: "#library",
				fontSize: "18",
			}),
		);
		const store = new Store({ fontSize: "16" });
		renderHook(() => useLocalStorage("main-store-hash", store, ["fontSize"]));
		expect(store.getRawState()).toEqual({
			fontSize: "18",
			_loaded: true,
		});
		expect(store.getRawState().hash).toBeUndefined();
	});

	it("loads all persisted fields when no field filter is given", () => {
		window.localStorage.setItem(
			"my-store-all",
			JSON.stringify({ theme: "dark", volume: 5 }),
		);
		const store = new Store({});
		renderHook(() => useLocalStorage("my-store-all", store));
		expect(store.getRawState()).toEqual({
			theme: "dark",
			volume: 5,
			_loaded: true,
		});
	});

	it("marks the store as loaded when nothing is persisted", () => {
		const store = new Store({});
		renderHook(() => useLocalStorage("my-store-empty", store));
		expect(store.getRawState()._loaded).toBe(true);
	});

	it("persists filtered fields back to localStorage on updates", () => {
		const store = new Store({});
		renderHook(() => useLocalStorage("my-store-persist", store, ["a"]));

		act(() => {
			store.update((s) => {
				s.a = 1;
				s.b = 2;
			});
		});

		expect(JSON.parse(window.localStorage.getItem("my-store-persist"))).toEqual(
			{ a: 1 },
		);
	});

	it("persists all fields when no field filter is given", () => {
		const store = new Store({});
		renderHook(() => useLocalStorage("my-store-persist-all", store));

		act(() => {
			store.update((s) => {
				s.a = 1;
			});
		});

		expect(
			JSON.parse(window.localStorage.getItem("my-store-persist-all")),
		).toEqual({ a: 1 });
	});

	it("removes the subscription on unmount", () => {
		const store = new Store({});
		const { unmount } = renderHook(() =>
			useLocalStorage("my-store-unmount", store),
		);
		unmount();
		expect(() =>
			store.update((s) => {
				s.x = 1;
			}),
		).not.toThrow();
	});
});

describe("useGlobalState", () => {
	afterEach(() => {
		StateStore.update((s) => {
			Object.keys(s).forEach((key) => delete s[key]);
		});
	});

	it("initializes state with defaults when unset", () => {
		const { result } = renderHook(() =>
			useGlobalState("global-defaults", { count: 0 }),
		);
		expect(result.current[0]).toEqual({ count: 0 });
	});

	it("updates the global state and shares it across hook instances", () => {
		const { result: a } = renderHook(() => useGlobalState("global-shared", 1));
		const { result: b } = renderHook(() => useGlobalState("global-shared", 1));

		act(() => {
			a.current[1](2);
		});

		expect(a.current[0]).toBe(2);
		expect(b.current[0]).toBe(2);
	});

	it("supports a functional updater", () => {
		const { result } = renderHook(() => useGlobalState("global-fn", 1));
		act(() => {
			result.current[1]((prev) => prev + 1);
		});
		expect(result.current[0]).toBe(2);
	});

	it("does nothing when no id is provided", () => {
		const { result } = renderHook(() => useGlobalState(undefined, "x"));
		expect(() =>
			act(() => {
				result.current[1]("y");
			}),
		).not.toThrow();
	});

	it("does not overwrite existing global state on mount", () => {
		StateStore.update((s) => {
			s["global-existing"] = "kept";
		});
		const { result } = renderHook(() =>
			useGlobalState("global-existing", "new"),
		);
		expect(result.current[0]).toBe("kept");
	});
});
