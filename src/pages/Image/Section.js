export function getImageSection({ label, translations }) {
    if (label) {
        return {
            label: translations[label]
        };
    }
    return {
        breadcrumbs: false
    };
}
