export function getSafeError(err) {
    const mapping = {
        "RATE_LIMIT_EXCEEDED": "Too many attempts, please try again later"
    };
    if (mapping[err]) {
        return mapping[err];
    }
    if (typeof err === "string") {
        return err;
    }
    return "INTERNAL_ERROR";
}
