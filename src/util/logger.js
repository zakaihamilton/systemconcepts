export function format({ date, utc, component, type, ...props }) {
    if (!date) {
        const dateObj = new Date();
        date = dateObj.toString();
        utc = dateObj.getTime();
    }
    const pairs = Object.entries(props);
    const format = [utc, " - ", date, "Component: ", component, " - ", "Type: ", type, ...pairs];
    return format;
}

export function log(props) {
    const args = format({ type: "log", ...props });
    console.log(...args);
}

export function error({ throwError = true, ...props }) {
    const args = format({ type: "error", ...props });
    console.errror(...args);
    if (throwError) {
        throw props;
    }
}

export function handle({ type = "log", props }) {
    if (type === "log") {
        log(props);
    }
    else if (type === "error") {
        error(props);
    }
}

if (typeof window !== "undefined") {
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        error({ msg, url, lineNo, columnNo, error, throwError: false });

        return false;
    }
}
