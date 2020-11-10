export function getContentSection({ sectionIndex, name, translations }) {
    if (sectionIndex) {
        return { name: name || translations.NEW_CONTENT };
    }
};
