import { useState, useEffect } from "react";
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
    const [inProgress, setProgress] = useState(false);
    const [result, setResult] = useState(null);
    const [, setTimeoutHandle] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => {
        if (cond && isOnline) {
            setResult(null);
            setError("");
            setProgress(true);
            setTimeoutHandle(handle => {
                if (handle) {
                    clearTimeout(handle);
                    handle = null;
                }
                handle = setTimeout(() => {
                    setTimeoutHandle(null);
                    fetchJSON(url, options).then(data => {
                        setResult(data);
                        setProgress(false);
                    }).catch(err => {
                        setProgress(false);
                        setError(err);
                    });
                }, delay);
                return handle;
            });
        }
        else {
            setTimeoutHandle(handle => {
                if (handle) {
                    clearTimeout(handle);
                    handle = null;
                }
                return handle;
            });
        }
    }, [...depends]);
    return [result, setResult, inProgress, error];
}

export function useFetch(url, options, depends = [], cond = true, delay = 0) {
    const isOnline = useOnline();
    const [inProgress, setProgress] = useState(false);
    const [result, setResult] = useState(null);
    const [, setTimeoutHandle] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => {
        if (cond && isOnline && url) {
            setResult(null);
            setError("");
            setProgress(true);
            setTimeoutHandle(handle => {
                if (handle) {
                    clearTimeout(handle);
                    handle = null;
                }
                handle = setTimeout(() => {
                    setTimeoutHandle(null);
                    fetchText(url, options).then(data => {
                        setResult(data);
                        setProgress(false);
                    }).catch(err => {
                        setProgress(false);
                        setError(err);
                    });
                }, delay);
                return handle;
            });
        }
        else {
            setTimeoutHandle(handle => {
                if (handle) {
                    clearTimeout(handle);
                    handle = null;
                }
                return handle;
            });
        }
    }, [url, ...depends]);
    return [result, setResult, inProgress, error];
}