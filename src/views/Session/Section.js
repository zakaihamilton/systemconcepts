export function getSessionSection({ date, name }) {
    const fullTitle = date + " " + name;
    return {
        label: fullTitle,
        tooltip: fullTitle
    };
}
