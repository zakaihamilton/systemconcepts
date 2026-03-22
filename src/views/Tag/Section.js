export function getTagSection({ sectionIndex, path, translations }) {
    if (sectionIndex) {
        return { name: path || translations.NEW_TAG };
    }
};
