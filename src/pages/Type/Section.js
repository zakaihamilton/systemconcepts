export function getTypeSection({ sectionIndex, name, translations }) {
    if (sectionIndex) {
        return { name: name || translations.NEW_TYPE };
    }
};
