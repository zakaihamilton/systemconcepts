import { useGlobalState } from "@util/browser/store";
import { makePath } from "@util/data/path";
import { useCallback, useEffect, useRef, useState } from "react";
import { storageMethods } from "./dispatch";

export function useListing(url: any, depends: unknown[] = [], options?: any) {
	const [listing, setListing] = useState<any>(null);
	const [loading, setLoading] = useState<any>(null);
	const [error, setError] = useState<any>(null);
	const active = useRef(url);
	const dependsString = JSON.stringify(depends);
	const optionsString = JSON.stringify(options);
	useEffect(() => {
		const loadingTimer = setTimeout(() => {
			setLoading(true);
			setError(null);
		}, 0);
		active.current = url;
		storageMethods
			.getListing(url, options)
			.then((listing) => {
				clearTimeout(loadingTimer);
				if (active.current === url) {
					setListing((prev: any) => {
						if (prev === listing) return prev;
						return listing;
					});
					setLoading((loading: any) => {
						if (loading === false) return loading;
						return false;
					});
				}
			})
			.catch((err) => {
				clearTimeout(loadingTimer);
				if (active.current === url) {
					setError((prev: any) => {
						if (prev === err) return prev;
						return err;
					});
					setLoading((loading: any) => {
						if (loading === false) return loading;
						return false;
					});
				}
			});
		return () => {
			clearTimeout(loadingTimer);
		};
	}, [url, optionsString, dependsString]);
	useEffect(() => {
		return () => {
			active.current = null;
		};
	}, []);
	return [listing, loading, error];
}

export function useFile(
	urlArgument: any,
	depends: unknown[] = [],
	mapping?: any,
) {
	const url = urlArgument && makePath(urlArgument);
	type FileState = {
		data?: any;
		loading?: boolean;
		error?: unknown;
		[key: string]: any;
	};
	const [state, setState] = useGlobalState<FileState>(
		url && "useFile:" + url,
		{},
	);
	const { data, loading, error } = state || {};
	const write = useCallback(
		async (data: any, path: any) => {
			path = path || url;
			if (typeof data === "function") {
				let stringData = "";
				await new Promise<void>((resolve) => {
					setState((state) => {
						const updatedData = data(state.data);
						if (typeof updatedData !== "string") {
							stringData = JSON.stringify(updatedData, null, 4);
						} else {
							stringData = updatedData;
						}
						resolve();
						state.data = updatedData;
						return { ...state };
					});
				});
				await storageMethods.createFolderPath(path);
				await storageMethods.writeFile(path, stringData);
			} else {
				let stringData = data;
				if (typeof stringData !== "string") {
					stringData = JSON.stringify(stringData, null, 4);
				}
				await storageMethods.createFolderPath(path);
				await storageMethods.writeFile(path, stringData);
				setState((state) => {
					state.data = data;
					return { ...state };
				});
			}
		},
		[url, setState],
	);
	const dependsString = JSON.stringify(depends);
	const mappingString = mapping?.toString();
	useEffect(() => {
		const timerHandle = setTimeout(() => {
			setState((state) => {
				state = state || {};
				if (state.error === null) {
					return state;
				}
				return { ...state, error: null };
			});
		}, 0);
		if (!url) {
			return () => clearTimeout(timerHandle);
		}
		setState((state) => {
			state = state || {};
			if (state.loading === true) {
				return state;
			}
			return { ...state, loading: true };
		});
		storageMethods
			.exists(url)
			.then((exists) => {
				if (!exists) {
					let data = null;
					if (mapping) {
						data = mapping(data, url);
					}
					setState((state) => {
						if (state.data === data && state.loading === false) {
							return state;
						}
						return { ...state, loading: false, data };
					});
					return;
				}
				storageMethods
					.readFile(url)
					.then((data) => {
						if (mapping) {
							data = mapping(data, url);
						}
						setState((state) => {
							if (state.data === data && state.loading === false) {
								return state;
							}
							return { ...state, data, loading: false };
						});
					})
					.catch((err) => {
						setState((state) => {
							if (state.error === err && state.loading === false) {
								return state;
							}
							return { ...state, error: err, loading: false };
						});
					});
			})
			.catch((err) => {
				setState((state) => {
					if (state.error === err && state.loading === false) {
						return state;
					}
					return { ...state, error: err, loading: false };
				});
			});
		return () => clearTimeout(timerHandle);
	}, [url, mappingString, setState, dependsString]);
	return [data, loading, error, write];
}
