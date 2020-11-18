export function getTypeSection({ sectionIndex, path, translations }) {
    if (sectionIndex) {
        return { name: path || translations.NEW_TYPE };
    }
};
