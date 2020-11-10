export function getTagSection({ sectionIndex, name, translations }) {
    if (sectionIndex) {
        return { name: name || translations.NEW_TAG };
    }
};
