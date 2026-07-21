import { logger as structuredLogger } from "@util/api/logger";
import { useOnline } from "@util/browser/online";
import Cookies from "js-cookie";
import { useEffect, useRef, useState } from "react";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
export const SIGNED_URL_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const responseCache = new Map();
let reloginRedirectStarted = false;

export function requireRelogin(response) {
	if (response.status !== 401 || reloginRedirectStarted) return false;
	reloginRedirectStarted = true;
	clearFetchCache();
	for (const name of ["id", "hash", "role"]) {
		Cookies.remove(name, { path: "/" });
		Cookies.remove(name);
	}
	const currentPath = window.location.hash.replace(/^#/, "");
	const isAuthPath = /^(account|signup|resetpassword)(?:[/?]|$)/.test(
		currentPath,
	);
	window.location.hash = isAuthPath
		? "account"
		: `account?redirect=${encodeURIComponent(currentPath)}`;
	window.setTimeout(() => {
		reloginRedirectStarted = false;
	}, 0);
	return true;
}

function getCacheKey(url, options = {}) {
	return JSON.stringify({
		url,
		method: options.method || "GET",
		headers: options.headers || {},
		body: options.body || null,
	});
}

function getCachedResponse(cacheKey) {
	const cached = responseCache.get(cacheKey);
	if (!cached || cached.expiresAt <= Date.now()) {
		responseCache.delete(cacheKey);
		return undefined;
	}
	return cached.value;
}

function setCachedResponse(cacheKey, value, ttl) {
	responseCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + ttl,
	});
}

export function clearFetchCache() {
	responseCache.clear();
}

export function __resetReloginGuardForTests() {
	reloginRedirectStarted = false;
}

export function getStableFetchCacheOptions(ttl = DEFAULT_CACHE_TTL_MS) {
	return {
		cacheResponse: true,
		cacheTtl: ttl,
	};
}

function extractCacheOptions(options) {
	const { cacheResponse, cacheTtl, ...fetchOptions } = options;
	return {
		cacheResponse: !!cacheResponse,
		cacheTtl: cacheTtl || DEFAULT_CACHE_TTL_MS,
		fetchOptions,
	};
}

export function fetchBlob(url, options) {
	options = Object.assign({}, options);
	options.headers = Object.assign({}, options.headers);
	return new Promise((resolve, reject) => {
		window
			.fetch(url, options)
			.then((response) => {
				if (requireRelogin(response)) {
					reject("AUTHENTICATION_REQUIRED");
					return;
				}
				if (response.status !== 200) {
					structuredLogger.debug("Status Code: " + response.status);
					reject(response.status);
					return;
				}
				response
					.blob()
					.then(function (data) {
						resolve(data);
					})
					.catch((err) => {
						structuredLogger.debug("Fetch parse error :", err);
						reject(err);
					});
			})
			.catch((err) => {
				structuredLogger.debug("Fetch error :", err);
				reject(err);
			});
	});
}

export function fetchText(url, options) {
	options = Object.assign({}, options);
	options.headers = Object.assign(
		{},
		{ "Content-Type": "text/plain", charset: "UTF-8" },
		options.headers,
	);
	const { cacheResponse, cacheTtl, fetchOptions } =
		extractCacheOptions(options);
	const cacheKey = cacheResponse ? getCacheKey(url, fetchOptions) : null;
	if (cacheKey) {
		const cached = getCachedResponse(cacheKey);
		if (cached !== undefined) return Promise.resolve(cached);
	}
	return new Promise((resolve, reject) => {
		window
			.fetch(url, fetchOptions)
			.then((response) => {
				if (requireRelogin(response)) {
					reject("AUTHENTICATION_REQUIRED");
					return;
				}
				if (response.status !== 200) {
					structuredLogger.debug("Status Code: " + response.status);
					reject(response.status);
					return;
				}
				response
					.text()
					.then(function (data) {
						if (cacheKey) setCachedResponse(cacheKey, data, cacheTtl);
						resolve(data);
					})
					.catch((err) => {
						structuredLogger.debug("Fetch parse error :", err);
						reject(err);
					});
			})
			.catch((err) => {
				structuredLogger.debug("Fetch error :", err);
				reject(err);
			});
	});
}

export function fetchJSON(url, options) {
	options = Object.assign({}, options);
	options.headers = Object.assign(
		{},
		{ "Content-Type": "application/json" },
		options.headers,
	);
	const { cacheResponse, cacheTtl, fetchOptions } =
		extractCacheOptions(options);
	const cacheKey = cacheResponse ? getCacheKey(url, fetchOptions) : null;
	if (cacheKey) {
		const cached = getCachedResponse(cacheKey);
		if (cached !== undefined) return Promise.resolve(cached);
	}
	return new Promise((resolve, reject) => {
		window
			.fetch(url, fetchOptions)
			.then((response) => {
				if (requireRelogin(response)) {
					reject("AUTHENTICATION_REQUIRED");
					return;
				}
				if (response.status !== 200) {
					structuredLogger.debug("Status Code: " + response.status);
					reject(response.status);
					return;
				}
				response
					.text()
					.then(function (data) {
						if (data) {
							data = JSON.parse(data);
						} else {
							data = null;
						}
						if (cacheKey) setCachedResponse(cacheKey, data, cacheTtl);
						resolve(data);
					})
					.catch((err) => {
						structuredLogger.debug("Fetch parse error :", err);
						reject(err);
					});
			})
			.catch((err) => {
				structuredLogger.debug("Fetch error :", err);
				reject(err);
			});
	});
}

export function useFetchJSON(
	url,
	options,
	depends = [],
	cond = true,
	delay = 0,
) {
	const isOnline = useOnline();
	const [reloadCount, setReloadCount] = useState(0);
	const [inProgress, setProgress] = useState(!!url && cond && isOnline);
	const [result, setResult] = useState(null);
	const timeoutRef = useRef(null);
	const [error, setError] = useState("");
	const reload = () => {
		setReloadCount((count) => count + 1);
	};
	const dependsString = JSON.stringify(depends);
	const optionsString = JSON.stringify(options);
	useEffect(() => {
		if (cond && isOnline) {
			setTimeout(() => {
				setResult(null);
				setError("");
				setProgress(true);
			}, 0);

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				fetchJSON(url, options)
					.then((data) => {
						setResult(data);
						setProgress(false);
					})
					.catch((err) => {
						setProgress(false);
						setError(err);
					});
			}, delay);
		} else {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		}
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [url, cond, optionsString, isOnline, delay, dependsString, reloadCount]); // eslint-disable-line react-hooks/exhaustive-deps
	return [result, setResult, inProgress, error, reload];
}

export function useFetch(url, options, depends = [], cond = true, delay = 0) {
	const isOnline = useOnline();
	const [reloadCount, setReloadCount] = useState(0);
	const [inProgress, setProgress] = useState(!!url && cond && isOnline);
	const [result, setResult] = useState(null);
	const timeoutRef = useRef(null);
	const [error, setError] = useState("");
	const reload = () => {
		setReloadCount((count) => count + 1);
	};
	const dependsString = JSON.stringify(depends);
	const optionsString = JSON.stringify(options);
	useEffect(() => {
		if (cond && isOnline && url) {
			setTimeout(() => {
				setResult(null);
				setError("");
				setProgress(true);
			}, 0);

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				fetchText(url, options)
					.then((data) => {
						setResult(data);
						setProgress(false);
					})
					.catch((err) => {
						setProgress(false);
						setError(err);
					});
			}, delay);
		} else {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		}
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [url, optionsString, cond, isOnline, delay, dependsString, reloadCount]); // eslint-disable-line react-hooks/exhaustive-deps
	return [result, setResult, inProgress, error, reload];
}
