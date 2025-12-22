export function getSafeError(err) {
    if (typeof err === "string") {
        return err;
    }
    return "INTERNAL_ERROR";
}
