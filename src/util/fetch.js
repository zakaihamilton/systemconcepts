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
    const [inProgress, setProgress] = useState(!!url && cond && isOnline);
    const [result, setResult] = useState(null);
    const [, setTimeoutHandle] = useState(null);
    const [error, setError] = useState("");
    const dependsString = JSON.stringify(depends);
    const optionsString = JSON.stringify(options);
    useEffect(() => {
        if (cond && isOnline) {
            const timerHandle = setTimeout(() => {
                setResult(prev => {
                    if (prev === null) return prev;
                    return null;
                });
                setError(prev => {
                    if (prev === "") return prev;
                    return "";
                });
                setProgress(prev => {
                    if (prev === true) return prev;
                    return true;
                });
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
            }, 0);
            return () => {
                clearTimeout(timerHandle);
            };
        }
        else {
            const timerHandle = setTimeout(() => {
                setTimeoutHandle(handle => {
                    if (handle) {
                        clearTimeout(handle);
                        handle = null;
                    }
                    return handle;
                });
            }, 0);
            return () => clearTimeout(timerHandle);
        }
    }, [url, cond, optionsString, isOnline, delay, dependsString]); // eslint-disable-line react-hooks/exhaustive-deps
    return [result, setResult, inProgress, error];
}

export function useFetch(url, options, depends = [], cond = true, delay = 0) {
    const isOnline = useOnline();
    const [inProgress, setProgress] = useState(!!url && cond && isOnline);
    const [result, setResult] = useState(null);
    const [, setTimeoutHandle] = useState(null);
    const [error, setError] = useState("");
    const dependsString = JSON.stringify(depends);
    const optionsString = JSON.stringify(options);
    useEffect(() => {
        if (cond && isOnline && url) {
            const timerHandle = setTimeout(() => {
                setResult(prev => {
                    if (prev === null) return prev;
                    return null;
                });
                setError(prev => {
                    if (prev === "") return prev;
                    return "";
                });
                setProgress(prev => {
                    if (prev === true) return prev;
                    return true;
                });
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
            }, 0);
            return () => {
                clearTimeout(timerHandle);
            };
        }
        else {
            const timerHandle = setTimeout(() => {
                setTimeoutHandle(handle => {
                    if (handle) {
                        clearTimeout(handle);
                        handle = null;
                    }
                    return handle;
                });
            }, 0);
            return () => clearTimeout(timerHandle);
        }
    }, [url, optionsString, cond, isOnline, delay, dependsString]); // eslint-disable-line react-hooks/exhaustive-deps
    return [result, setResult, inProgress, error];
}