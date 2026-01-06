import { useState, useEffect, useRef } from "react";
import { useOnline } from "@util/online";

export function fetchBlob(url, options) {
    options = Object.assign({}, options);
    options.headers = Object.assign({}, options.headers);
    return new Promise((resolve, reject) => {
        window.fetch(url, options).then(response => {
            if (response.status !== 200) {
                console.log("Status Code: " +
                    response.status);
                reject(response.status);
                return;
            }
            response.blob().then(function (data) {
                resolve(data);
            }).catch(err => {
                console.log("Fetch parse error :", err);
                reject(err);
            });
        }).catch(err => {
            console.log("Fetch error :", err);
            reject(err);
        });
    });
}

export function fetchText(url, options) {
    options = Object.assign({}, options);
    options.headers = Object.assign({}, { "Content-Type": "text/plain", charset: "UTF-8" }, options.headers);
    return new Promise((resolve, reject) => {
        window.fetch(url, options).then(response => {
            if (response.status !== 200) {
                console.log("Status Code: " +
                    response.status);
                reject(response.status);
                return;
            }
            response.text().then(function (data) {
                resolve(data);
            }).catch(err => {
                console.log("Fetch parse error :", err);
                reject(err);
            });
        }).catch(err => {
            console.log("Fetch error :", err);
            reject(err);
        });
    });
}

export function fetchJSON(url, options) {
    options = Object.assign({}, options);
    options.headers = Object.assign({}, { "Content-Type": "application/json" }, options.headers);
    return new Promise((resolve, reject) => {
        window.fetch(url, options).then(response => {
            if (response.status !== 200) {
                console.log("Status Code: " +
                    response.status);
                reject(response.status);
                return;
            }
            response.text().then(function (data) {
                if (data) {
                    data = JSON.parse(data);
                }
                else {
                    data = null;
                }
                resolve(data);
            }).catch(err => {
                console.log("Fetch parse error :", err);
                reject(err);
            });
        }).catch(err => {
            console.log("Fetch error :", err);
            reject(err);
        });
    });
}

export function useFetchJSON(url, options, depends = [], cond = true, delay = 0) {
    const isOnline = useOnline();
    const dependsString = JSON.stringify(depends);
    const optionsString = JSON.stringify(options);

    const [state, setState] = useState({
        result: null,
        error: "",
        inProgress: !!url && cond && isOnline
    });

    const [prevArgs, setPrevArgs] = useState({ url, optionsString, dependsString, cond, isOnline });

    if (
        url !== prevArgs.url ||
        optionsString !== prevArgs.optionsString ||
        dependsString !== prevArgs.dependsString ||
        cond !== prevArgs.cond ||
        isOnline !== prevArgs.isOnline
    ) {
        setPrevArgs({ url, optionsString, dependsString, cond, isOnline });
        setState({
            result: null,
            error: "",
            inProgress: !!url && cond && isOnline
        });
    }

    useEffect(() => {
        if (!cond || !isOnline) return;

        let active = true;
        const timeoutId = setTimeout(() => {
            fetchJSON(url, options).then(data => {
                if (active) {
                    setState(prev => ({ ...prev, result: data, inProgress: false }));
                }
            }).catch(err => {
                if (active) {
                    setState(prev => ({ ...prev, error: err, inProgress: false }));
                }
            });
        }, delay);

        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, [url, optionsString, dependsString, cond, isOnline, delay]); // eslint-disable-line react-hooks/exhaustive-deps

    const setResult = (val) => setState(prev => ({ ...prev, result: val }));

    return [state.result, setResult, state.inProgress, state.error];
}

export function useFetch(url, options, depends = [], cond = true, delay = 0) {
    const isOnline = useOnline();
    const dependsString = JSON.stringify(depends);
    const optionsString = JSON.stringify(options);

    const [state, setState] = useState({
        result: null,
        error: "",
        inProgress: !!url && cond && isOnline
    });

    const [prevArgs, setPrevArgs] = useState({ url, optionsString, dependsString, cond, isOnline });

    if (
        url !== prevArgs.url ||
        optionsString !== prevArgs.optionsString ||
        dependsString !== prevArgs.dependsString ||
        cond !== prevArgs.cond ||
        isOnline !== prevArgs.isOnline
    ) {
        setPrevArgs({ url, optionsString, dependsString, cond, isOnline });
        setState({
            result: null,
            error: "",
            inProgress: !!url && cond && isOnline
        });
    }

    useEffect(() => {
        if (cond && isOnline && url) {
            let active = true;
            const timeoutId = setTimeout(() => {
                fetchText(url, options).then(data => {
                    if (active) {
                        setState(prev => ({ ...prev, result: data, inProgress: false }));
                    }
                }).catch(err => {
                    if (active) {
                        setState(prev => ({ ...prev, error: err, inProgress: false }));
                    }
                });
            }, delay);

            return () => {
                active = false;
                clearTimeout(timeoutId);
            };
        }
    }, [url, optionsString, cond, isOnline, delay, dependsString]); // eslint-disable-line react-hooks/exhaustive-deps

    const setResult = (val) => setState(prev => ({ ...prev, result: val }));

    return [state.result, setResult, state.inProgress, state.error];
}
