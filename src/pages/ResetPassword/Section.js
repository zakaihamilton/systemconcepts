export function getResetSection({ sectionIndex, translations }) {
    if (sectionIndex) {
        return { name: translations.CHANGE_PASSWORD, tooltip: translations.CHANGE_PASSWORD };
    }
    return {};
}

