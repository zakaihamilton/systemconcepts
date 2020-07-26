export function nextTrimmedString(values, current) {
    let index = (values || []).findIndex(value => (typeof value === "string" && value.trim()) === current);
    if (index === -1) {
        index = 0;
    }
    else {
        index = (index + 1) % values.length;
    }
    const value = values[index];
    return value;
}
